from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError

from acceptance_live import (
    api,
    create_user,
    physical_id,
    stack_outputs,
    synthetic_pdf,
    utc_now,
    wait_documents,
    wait_job,
)


ROOT = Path(__file__).resolve().parents[2]
POLICY_PACKAGE = ROOT / "backend" / "data" / "pm-usp-csss-2026-27.3" / "manifest.json"


def upload_document(base: str, token: str, app_id: str, document_type: str, data: bytes) -> str:
    _, upload = api(
        base,
        "POST",
        "/documents/uploads",
        token,
        {
            "applicationId": app_id,
            "documentType": document_type,
            "contentType": "application/pdf",
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        },
    )
    with urlopen(Request(upload["uploadUrl"], method="PUT", data=data, headers=upload["requiredHeaders"]), timeout=120) as response:
        assert response.status == 200
    api(base, "POST", f"/documents/{upload['documentId']}/complete", token, {})
    return upload["documentId"]


def confirm(base: str, token: str, app_id: str, document_id: str, facts: dict[str, Any]) -> None:
    api(base, "PATCH", f"/applications/{app_id}/documents/{document_id}/facts", token, {"facts": facts})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a full disposable workflow with one deliberately faulty document")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--report", type=Path, default=ROOT / "artifacts" / "acceptance" / "faulty-document-mock-latest.json")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session, args.stack)
    cognito = session.client("cognito-idp")
    lambda_client = session.client("lambda")
    username = owner_sub = ""
    deleted = False
    report: dict[str, Any] = {"startedAt": utc_now(), "stack": args.stack, "scenario": "FAULTY_INCOME_CERTIFICATE_NO_REJECTION_REASON"}

    try:
        username, owner_sub, token = create_user(cognito, outputs["UserPoolId"], outputs["UserPoolClientId"], "citizen")
        manifest = json.loads(POLICY_PACKAGE.read_text(encoding="utf-8"))
        fields = manifest["demoCases"]["freshEligible"]

        _, application = api(outputs["ApiUrl"], "POST", "/applications", token, {"schemeId": "pm-usp-csss"})
        app_id = application["appId"]
        api(outputs["ApiUrl"], "PATCH", f"/applications/{app_id}/draft", token, {"fields": fields, "expectedRevision": 0})

        documents = {
            "IDENTITY_PROOF": synthetic_pdf("Synthetic Identity Evidence", ["Applicant Name: Aditi Sharma", "Demo Identifier: TEST-FAULT-001"]),
            "MARKSHEET": synthetic_pdf("Synthetic Class XII Marksheet", ["Student Name: Aditi Sharma", "Board Percentile: 91"]),
            "INCOME_CERTIFICATE": synthetic_pdf("Synthetic Faulty Income Certificate", ["Applicant Name: Aditi Sharma", "Annual Family Income: INR 900000"]),
            "ADMISSION_LETTER": synthetic_pdf("Synthetic Admission Letter", ["Student Name: Aditi Sharma", "Institution: Fictional National College", "Course: Bachelor Degree"]),
        }
        document_ids = {
            document_type: upload_document(outputs["ApiUrl"], token, app_id, document_type, data)
            for document_type, data in documents.items()
        }
        ocr_states = wait_documents(outputs["ApiUrl"], token, app_id, document_ids)
        standard_name = {"primaryName": {"value": "Aditi Sharma", "confidence": 100}}
        for document_type, document_id in document_ids.items():
            facts = dict(standard_name)
            if document_type == "INCOME_CERTIFICATE":
                facts["annualIncomeINR"] = {"value": 900000, "confidence": 100}
            confirm(outputs["ApiUrl"], token, app_id, document_id, facts)

        _, validation = api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/validate", token, {})
        faulty_validation = wait_job(outputs["ApiUrl"], token, validation["jobId"])
        _, view = api(outputs["ApiUrl"], "GET", f"/applications/{app_id}", token)
        run_id = faulty_validation["result"]["runId"]
        income_check = next(check for check in view["checks"] if check["runId"] == run_id and check["ruleId"] == "fresh-income-certificate-match")
        assert income_check["status"] == "FAIL", income_check
        assert int(income_check["actual"]) == 350000 and int(income_check["expected"]) == 900000, income_check

        api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/versions", token, {})
        _, diagnosis = api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/diagnoses", token, {})
        diagnosis_job = wait_job(outputs["ApiUrl"], token, diagnosis["jobId"])
        assert diagnosis_job["result"]["category"] == "INCOME_MISMATCH", diagnosis_job
        assert diagnosis_job["result"]["diagnosisBasis"] == "INFERRED_FROM_CHECKS", diagnosis_job
        _, repair = api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/repairs", token, {"diagnosisId": diagnosis["diagnosisId"]})

        api(outputs["ApiUrl"], "DELETE", f"/documents/{document_ids['INCOME_CERTIFICATE']}", token)
        corrected_pdf = synthetic_pdf("Synthetic Corrected Income Certificate", ["Applicant Name: Aditi Sharma", "Annual Family Income: INR 350000"])
        corrected_id = upload_document(outputs["ApiUrl"], token, app_id, "INCOME_CERTIFICATE", corrected_pdf)
        wait_documents(outputs["ApiUrl"], token, app_id, {"INCOME_CERTIFICATE": corrected_id})
        confirm(
            outputs["ApiUrl"],
            token,
            app_id,
            corrected_id,
            {"primaryName": {"value": "Aditi Sharma", "confidence": 100}, "annualIncomeINR": {"value": 350000, "confidence": 100}},
        )

        _, validation = api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/validate", token, {})
        corrected_validation = wait_job(outputs["ApiUrl"], token, validation["jobId"])
        assert corrected_validation["result"]["summary"]["ready"] is True, corrected_validation
        _, corrected_version = api(outputs["ApiUrl"], "POST", f"/applications/{app_id}/versions", token, {})

        report.update(
            {
                "status": "PASS",
                "applicationId": app_id,
                "policyVersionId": application["policyVersionId"],
                "requiredDocuments": list(documents),
                "ocrStates": ocr_states,
                "faultInjected": {"documentType": "INCOME_CERTIFICATE", "declaredIncomeINR": 350000, "documentIncomeINR": 900000},
                "faultDetected": {"ruleId": income_check["ruleId"], "status": income_check["status"]},
                "diagnosis": diagnosis_job["result"],
                "repairId": repair["repairId"],
                "correction": {"replacementIncomeINR": 350000, "ready": True, "versionId": corrected_version["versionId"]},
            }
        )

        api(outputs["ApiUrl"], "POST", "/me/deletion", token, {})
        deadline = time.time() + 120
        while time.time() < deadline:
            users = cognito.list_users(UserPoolId=outputs["UserPoolId"], Filter=f'email = "{username}"', Limit=1).get("Users", [])
            if not users:
                deleted = True
                break
            time.sleep(3)
        assert deleted
        report["cleanup"] = "PASS"
        report["completedAt"] = utc_now()
    finally:
        if username and not deleted:
            try:
                lambda_client.invoke(
                    FunctionName=physical_id(session, args.stack, "DeletionFunction"),
                    InvocationType="RequestResponse",
                    Payload=json.dumps({"ownerSub": owner_sub, "jobId": "faulty-mock-cleanup"}).encode("utf-8"),
                )
            except Exception:
                try:
                    cognito.admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=username)
                except ClientError:
                    pass

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()

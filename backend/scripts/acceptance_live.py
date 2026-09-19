from __future__ import annotations

import argparse
import base64
import hashlib
import json
import secrets
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError


TERMINAL_DOCUMENT_STATES = {
    "EXTRACTED",
    "NEEDS_USER_CONFIRMATION",
    "UNSUPPORTED_LANGUAGE",
    "OCR_FAILED_FINAL",
    "CONFIRMED",
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def stack_outputs(session: boto3.Session, stack_name: str) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=stack_name)["Stacks"][0]
    return {item["OutputKey"]: item["OutputValue"] for item in stack.get("Outputs", [])}


def physical_id(session: boto3.Session, stack_name: str, logical_id: str) -> str:
    detail = session.client("cloudformation").describe_stack_resource(
        StackName=stack_name,
        LogicalResourceId=logical_id,
    )["StackResourceDetail"]
    return detail["PhysicalResourceId"]


def api(
    base: str,
    method: str,
    path: str,
    token: str | None = None,
    body: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(base.rstrip("/") + path, method=method, headers=headers, data=data)
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read()
        payload = json.loads(raw) if raw else {}
        raise AssertionError(f"{method} {path} returned {exc.code}: {payload}") from exc


def wait_job(base: str, token: str, job_id: str, timeout: int = 180) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        _, job = api(base, "GET", f"/jobs/{job_id}", token)
        if job.get("status") in {"COMPLETED", "FAILED"}:
            assert job["status"] == "COMPLETED", job
            return job
        time.sleep(2)
    raise TimeoutError(f"Job {job_id} did not complete")


def synthetic_pdf(title: str, lines: list[str]) -> bytes:
    def escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    text = ["BT", "/F1 15 Tf", "72 750 Td", f"({escape(title)}) Tj", "/F1 10 Tf"]
    for line in ["SYNTHETIC DEMO - NOT AN OFFICIAL DOCUMENT", *lines]:
        text.extend(["0 -24 Td", f"({escape(line)}) Tj"])
    text.append("ET")
    stream = "\n".join(text).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    result = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(result))
        result.extend(f"{number} 0 obj\n".encode("ascii"))
        result.extend(obj)
        result.extend(b"\nendobj\n")
    xref = len(result)
    result.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    result.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    result.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii")
    )
    return bytes(result)


DOCUMENTS = {
    "IDENTITY_PROOF": synthetic_pdf(
        "Synthetic Identity Evidence",
        ["Applicant Name: Aditi Sharma", "Date of Birth: 15 August 2007", "Demo Identifier: TEST-0001"],
    ),
    "MARKSHEET": synthetic_pdf(
        "Synthetic Class XII Marksheet",
        ["Student Name: Aditi Sharma", "Academic Year: 2025-26", "Board Percentile: 91"],
    ),
    "INCOME_CERTIFICATE": synthetic_pdf(
        "Synthetic Family Income Certificate",
        ["Applicant Name: Aditi Sharma", "Annual Family Income: INR 350000", "Financial Year: 2025-26"],
    ),
    "ADMISSION_LETTER": synthetic_pdf(
        "Synthetic Admission Letter",
        ["Student Name: Aditi Sharma", "Institution Name: Fictional National College", "Course: Bachelor Degree"],
    ),
    "PREVIOUS_YEAR_MARKSHEET": synthetic_pdf(
        "Synthetic Previous-Year Marksheet",
        ["Student Name: Aditi Sharma", "Academic Year: 2025-26", "Marks Percent: 72"],
    ),
    "ATTENDANCE_CERTIFICATE": synthetic_pdf(
        "Synthetic Attendance Certificate",
        ["Student Name: Aditi Sharma", "Academic Year: 2025-26", "Attendance Percent: 84"],
    ),
}


def upload_documents(base: str, token: str, app_id: str, document_types: list[str]) -> dict[str, str]:
    ids: dict[str, str] = {}
    for document_type in document_types:
        data = DOCUMENTS[document_type]
        digest = hashlib.sha256(data).hexdigest()
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
                "sha256": digest,
            },
        )
        request = Request(upload["uploadUrl"], method="PUT", data=data, headers=upload["requiredHeaders"])
        with urlopen(request, timeout=120) as response:
            assert response.status == 200
        api(base, "POST", f"/documents/{upload['documentId']}/complete", token, {})
        ids[document_type] = upload["documentId"]
    return ids


def wait_documents(base: str, token: str, app_id: str, document_ids: dict[str, str], timeout: int = 300) -> dict[str, str]:
    deadline = time.time() + timeout
    states: dict[str, str] = {}
    wanted = set(document_ids.values())
    while time.time() < deadline:
        _, view = api(base, "GET", f"/applications/{app_id}", token)
        states = {
            document["documentId"]: document["state"]
            for document in view["documents"]
            if document["documentId"] in wanted
        }
        if len(states) == len(wanted) and all(state in TERMINAL_DOCUMENT_STATES for state in states.values()):
            break
        time.sleep(5)
    assert len(states) == len(wanted), states
    assert all(state in {"EXTRACTED", "NEEDS_USER_CONFIRMATION"} for state in states.values()), states
    return {document_type: states[document_id] for document_type, document_id in document_ids.items()}


def confirm_documents(base: str, token: str, app_id: str, document_ids: dict[str, str]) -> None:
    for document_type, document_id in document_ids.items():
        facts: dict[str, Any] = {"primaryName": {"value": "Aditi Sharma", "confidence": 100}}
        if document_type == "INCOME_CERTIFICATE":
            facts["annualIncomeINR"] = {"value": 350000, "confidence": 100}
        api(base, "PATCH", f"/applications/{app_id}/documents/{document_id}/facts", token, {"facts": facts})


def create_user(cognito: Any, pool_id: str, client_id: str, role: str) -> tuple[str, str, str]:
    username = f"acceptance-{role}-{int(time.time())}-{secrets.token_hex(3)}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    user = cognito.admin_create_user(
        UserPoolId=pool_id,
        Username=username,
        UserAttributes=[
            {"Name": "email", "Value": username},
            {"Name": "email_verified", "Value": "true"},
        ],
        MessageAction="SUPPRESS",
    )["User"]
    owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
    cognito.admin_set_user_password(UserPoolId=pool_id, Username=username, Password=password, Permanent=True)
    cognito.admin_add_user_to_group(UserPoolId=pool_id, Username=username, GroupName=role)
    auth = cognito.initiate_auth(
        ClientId=client_id,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": username, "PASSWORD": password},
    )
    return username, owner_sub, auth["AuthenticationResult"]["IdToken"]


def invoke_json(lambda_client: Any, function_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = lambda_client.invoke(
        FunctionName=function_name,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    raw = response["Payload"].read()
    decoded = json.loads(raw) if raw else {}
    if response.get("FunctionError"):
        raise AssertionError(f"Lambda {function_name} failed: {decoded}")
    return decoded


def exercise_knowledge_base(session: boto3.Session, outputs: dict[str, str]) -> dict[str, Any]:
    result: dict[str, Any] = {"embeddingModel": "amazon.titan-embed-text-v2:0"}
    try:
        runtime = session.client("bedrock-runtime")
        response = runtime.invoke_model(
            modelId=result["embeddingModel"],
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": "PM-USP verified policy ingestion acceptance check"}),
        )
        embedding = json.loads(response["body"].read())
        result["embeddingInvocation"] = "PASS"
        result["embeddingDimensions"] = len(embedding.get("embedding", []))
    except ClientError as exc:
        error = exc.response.get("Error", {})
        result["embeddingInvocation"] = "BLOCKED"
        result["embeddingError"] = f"{error.get('Code')}: {error.get('Message')}"

    if not outputs.get("KnowledgeBaseId") or not outputs.get("KnowledgeBaseDataSourceId"):
        result["ingestion"] = "NOT_CONFIGURED"
        return result
    try:
        client = session.client("bedrock-agent")
        job = client.start_ingestion_job(
            knowledgeBaseId=outputs["KnowledgeBaseId"],
            dataSourceId=outputs["KnowledgeBaseDataSourceId"],
            description="SevaFix verified data end-to-end acceptance",
        )["ingestionJob"]
        job_id = job["ingestionJobId"]
        deadline = time.time() + 300
        while time.time() < deadline:
            job = client.get_ingestion_job(
                knowledgeBaseId=outputs["KnowledgeBaseId"],
                dataSourceId=outputs["KnowledgeBaseDataSourceId"],
                ingestionJobId=job_id,
            )["ingestionJob"]
            if job["status"] in {"COMPLETE", "FAILED", "STOPPED"}:
                break
            time.sleep(5)
        result["ingestionJobId"] = job_id
        result["ingestion"] = job["status"]
        result["ingestionStatistics"] = job.get("statistics", {})
        result["ingestionFailureReasons"] = job.get("failureReasons", [])
    except ClientError as exc:
        error = exc.response.get("Error", {})
        result["ingestion"] = "BLOCKED"
        result["ingestionError"] = f"{error.get('Code')}: {error.get('Message')}"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the complete SevaFix live acceptance journey")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--report", type=Path, default=Path("artifacts/acceptance/latest.json"))
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session, args.stack)
    cognito = session.client("cognito-idp")
    lambda_client = session.client("lambda")
    table = session.resource("dynamodb").Table(outputs["TableName"])
    report: dict[str, Any] = {
        "startedAt": utc_now(),
        "stack": args.stack,
        "region": args.region,
        "policy": {},
        "workflows": {},
    }
    users: list[tuple[str, str]] = []
    citizen_deleted = False
    try:
        source_monitor = invoke_json(
            lambda_client,
            physical_id(session, args.stack, "SourceMonitorFunction"),
            {},
        )
        report["workflows"]["officialSourceMonitor"] = source_monitor
        assert source_monitor["failed"] == 0, source_monitor
        assert source_monitor["checked"] == 5, source_monitor

        scheme = table.get_item(
            Key={"PK": "SCHEME#pm-usp-csss", "SK": "META"},
            ConsistentRead=True,
        )["Item"]
        active_version = scheme["activePolicyVersionId"]
        rules = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues={":pk": f"RULESET#{active_version}", ":prefix": "RULE#"},
            ConsistentRead=True,
        )["Items"]
        claims = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues={":pk": "POLICY#pm-usp-csss", ":prefix": f"CLAIM#{active_version}#"},
            ConsistentRead=True,
        )["Items"]
        sources = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues={":pk": "SOURCES#REGISTRY", ":prefix": "SOURCE#"},
            ConsistentRead=True,
        )["Items"]
        enabled_sources = [source for source in sources if source.get("enabled", True)]
        report["policy"] = {
            "activeVersion": active_version,
            "ruleCount": len(rules),
            "claimCount": len(claims),
            "enabledSourceCount": len(enabled_sources),
            "formFieldCount": sum(len(section["fields"]) for section in scheme["formSchema"]["sections"]),
            "freshDocumentCount": len(scheme["documentChecklist"]["FRESH"]),
            "renewalDocumentCount": len(scheme["documentChecklist"]["RENEWAL"]),
            "liveWindowVerificationState": scheme["liveWindow"]["verificationState"],
        }
        assert active_version == "pm-usp-csss-2026-27.3", report["policy"]
        assert len(rules) == 17 and len(claims) == 12 and len(enabled_sources) == 5
        assert report["policy"]["renewalDocumentCount"] == 4

        citizen_name, citizen_sub, citizen_token = create_user(
            cognito,
            outputs["UserPoolId"],
            outputs["UserPoolClientId"],
            "citizen",
        )
        users.append((citizen_name, citizen_sub))
        reviewer_name, reviewer_sub, reviewer_token = create_user(
            cognito,
            outputs["UserPoolId"],
            outputs["UserPoolClientId"],
            "policy-reviewer",
        )
        users.append((reviewer_name, reviewer_sub))
        report["workflows"]["cognitoAuthentication"] = "PASS"

        status, health = api(outputs["ApiUrl"], "GET", "/health")
        assert status == 200 and health["status"] == "ok"
        _, catalog = api(outputs["ApiUrl"], "GET", "/schemes", citizen_token)
        live_scheme = next(item for item in catalog["items"] if item["schemeId"] == "pm-usp-csss")
        assert live_scheme["activePolicyVersionId"] == active_version
        api(
            outputs["ApiUrl"],
            "PATCH",
            "/me",
            citizen_token,
            {"displayName": "Aditi Sharma", "locale": "en-IN", "notificationOptIn": True},
        )
        _, profile = api(outputs["ApiUrl"], "GET", "/me", citizen_token)
        assert profile["displayName"] == "Aditi Sharma"
        report["workflows"]["healthCatalogProfile"] = "PASS"

        manifest = json.loads(
            (Path(__file__).resolve().parents[1] / "data" / "pm-usp-csss-2026-27.3" / "manifest.json").read_text(encoding="utf-8")
        )
        fresh_fields = manifest["demoCases"]["freshEligible"]
        _, fresh = api(outputs["ApiUrl"], "POST", "/applications", citizen_token, {"schemeId": "pm-usp-csss"})
        fresh_id = fresh["appId"]
        api(outputs["ApiUrl"], "PATCH", f"/applications/{fresh_id}/draft", citizen_token, {"fields": fresh_fields, "expectedRevision": 0})
        _, queued = api(outputs["ApiUrl"], "POST", f"/applications/{fresh_id}/validate", citizen_token, {})
        blocked = wait_job(outputs["ApiUrl"], citizen_token, queued["jobId"])
        assert blocked["result"]["summary"]["blocked"] >= 1
        _, version = api(outputs["ApiUrl"], "POST", f"/applications/{fresh_id}/versions", citizen_token, {})
        assert version["versionId"] == "v1"
        fresh_docs = upload_documents(
            outputs["ApiUrl"],
            citizen_token,
            fresh_id,
            ["IDENTITY_PROOF", "MARKSHEET", "INCOME_CERTIFICATE", "ADMISSION_LETTER"],
        )
        fresh_ocr_states = wait_documents(outputs["ApiUrl"], citizen_token, fresh_id, fresh_docs)
        confirm_documents(outputs["ApiUrl"], citizen_token, fresh_id, fresh_docs)
        _, view = api(outputs["ApiUrl"], "POST", f"/documents/{fresh_docs['IDENTITY_PROOF']}/view-url", citizen_token, {})
        assert view["viewUrl"].startswith("https://") and view["expiresIn"] > 0
        _, queued = api(outputs["ApiUrl"], "POST", f"/applications/{fresh_id}/validate", citizen_token, {})
        ready = wait_job(outputs["ApiUrl"], citizen_token, queued["jobId"])
        assert ready["result"]["summary"]["ready"] is True, ready
        _, version = api(outputs["ApiUrl"], "POST", f"/applications/{fresh_id}/versions", citizen_token, {})
        assert version["versionId"] == "v2"
        submitted_at = utc_now()
        api(
            outputs["ApiUrl"],
            "POST",
            f"/applications/{fresh_id}/official-submission",
            citizen_token,
            {"officialApplicationId": "NSP-SYNTHETIC-2026-0001", "submittedAt": submitted_at},
        )
        api(
            outputs["ApiUrl"],
            "POST",
            f"/applications/{fresh_id}/timeline-events",
            citizen_token,
            {"eventType": "STATUS_CHECKED", "payload": {"status": "UNDER_VERIFICATION", "source": "USER_CONFIRMED_DEMO"}},
        )
        _, diagnosis = api(
            outputs["ApiUrl"],
            "POST",
            f"/applications/{fresh_id}/diagnoses",
            citizen_token,
            {"reasonText": "Returned because family income does not match the income certificate"},
        )
        diagnosis_job = wait_job(outputs["ApiUrl"], citizen_token, diagnosis["jobId"])
        assert diagnosis_job["result"]["category"] == "INCOME_MISMATCH", diagnosis_job
        _, repair = api(
            outputs["ApiUrl"],
            "POST",
            f"/applications/{fresh_id}/repairs",
            citizen_token,
            {"diagnosisId": diagnosis["diagnosisId"]},
        )
        _, fresh_view = api(outputs["ApiUrl"], "GET", f"/applications/{fresh_id}", citizen_token)
        revision = int(fresh_view["application"]["revision"])
        api(
            outputs["ApiUrl"],
            "PATCH",
            f"/applications/{fresh_id}/draft",
            citizen_token,
            {"fields": {"student.familyAnnualIncomeINR": 350000}, "expectedRevision": revision},
        )
        _, version = api(outputs["ApiUrl"], "POST", f"/applications/{fresh_id}/versions", citizen_token, {})
        assert version["versionId"] == "v3"
        deleted_doc_id = fresh_docs["MARKSHEET"]
        _, deleted_doc = api(outputs["ApiUrl"], "DELETE", f"/documents/{deleted_doc_id}", citizen_token)
        assert deleted_doc["state"] == "DELETED"
        report["workflows"]["freshApplication"] = {
            "status": "PASS",
            "ocrStates": fresh_ocr_states,
            "initialBlocked": blocked["result"]["summary"],
            "ready": ready["result"]["summary"],
            "versions": ["v1", "v2", "v3"],
            "diagnosisCategory": diagnosis_job["result"]["category"],
            "repairIdCreated": bool(repair.get("repairId")),
            "documentViewUrlIssued": True,
            "documentDeletion": "PASS",
            "submissionAndTimeline": "PASS",
        }

        renewal_fields = manifest["demoCases"]["renewalEligible"]
        _, renewal = api(outputs["ApiUrl"], "POST", "/applications", citizen_token, {"schemeId": "pm-usp-csss"})
        renewal_id = renewal["appId"]
        api(outputs["ApiUrl"], "PATCH", f"/applications/{renewal_id}/draft", citizen_token, {"fields": renewal_fields, "expectedRevision": 0})
        renewal_docs = upload_documents(
            outputs["ApiUrl"],
            citizen_token,
            renewal_id,
            ["IDENTITY_PROOF", "ADMISSION_LETTER", "PREVIOUS_YEAR_MARKSHEET", "ATTENDANCE_CERTIFICATE"],
        )
        renewal_ocr_states = wait_documents(outputs["ApiUrl"], citizen_token, renewal_id, renewal_docs)
        confirm_documents(outputs["ApiUrl"], citizen_token, renewal_id, renewal_docs)
        _, queued = api(outputs["ApiUrl"], "POST", f"/applications/{renewal_id}/validate", citizen_token, {})
        renewal_ready = wait_job(outputs["ApiUrl"], citizen_token, queued["jobId"])
        assert renewal_ready["result"]["summary"]["ready"] is True, renewal_ready
        _, renewal_version = api(outputs["ApiUrl"], "POST", f"/applications/{renewal_id}/versions", citizen_token, {})
        assert renewal_version["versionId"] == "v1"
        report["workflows"]["renewalApplication"] = {
            "status": "PASS",
            "ocrStates": renewal_ocr_states,
            "ready": renewal_ready["result"]["summary"],
            "version": "v1",
        }

        _, source_changes = api(outputs["ApiUrl"], "GET", "/review/source-changes", reviewer_token)
        review_actions: list[str] = []
        if source_changes["items"]:
            first = source_changes["items"][0]["changeId"]
            api(outputs["ApiUrl"], "POST", f"/review/source-changes/{first}/approve", reviewer_token, {})
            review_actions.append("APPROVE")
        if len(source_changes["items"]) > 1:
            second = source_changes["items"][1]["changeId"]
            api(
                outputs["ApiUrl"],
                "POST",
                f"/review/source-changes/{second}/reject",
                reviewer_token,
                {"reason": "Acceptance review: duplicate historical snapshot superseded by verified package"},
            )
            review_actions.append("REJECT")

        versions = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues={":pk": "POLICY#pm-usp-csss", ":prefix": "VERSION#"},
            ConsistentRead=True,
        )["Items"]
        previous_versions = [item["policyVersionId"] for item in versions if item["policyVersionId"] != active_version]
        if previous_versions:
            previous = sorted(previous_versions)[-1]
            api(
                outputs["ApiUrl"],
                "POST",
                f"/review/policy-versions/{previous}/rollback-pointer",
                reviewer_token,
                {"schemeId": "pm-usp-csss", "auditReason": "Acceptance rehearsal of rollback control", "confirmation": "ROLLBACK"},
            )
            api(
                outputs["ApiUrl"],
                "POST",
                f"/review/policy-versions/{active_version}/rollback-pointer",
                reviewer_token,
                {"schemeId": "pm-usp-csss", "auditReason": "Restore current verified package after acceptance rehearsal", "confirmation": "ROLLBACK"},
            )
            review_actions.extend(["ROLLBACK_POINTER", "RESTORE_POINTER"])
        restored = table.get_item(Key={"PK": "SCHEME#pm-usp-csss", "SK": "META"}, ConsistentRead=True)["Item"]
        assert restored["activePolicyVersionId"] == active_version
        report["workflows"]["policyReviewer"] = {
            "status": "PASS",
            "pendingChangesSeen": len(source_changes["items"]),
            "actions": review_actions,
            "activeVersionRestored": active_version,
        }

        notification = invoke_json(
            lambda_client,
            physical_id(session, args.stack, "NotificationFunction"),
            {
                "Records": [
                    {
                        "body": json.dumps(
                            {
                                "type": "ACCEPTANCE_TEST",
                                "title": "Verified policy loaded",
                                "message": "Synthetic non-sensitive end-to-end acceptance event",
                            }
                        )
                    }
                ]
            },
        )
        assert notification["delivered"] == 1, notification
        report["workflows"]["notification"] = {"status": "PASS", **notification}
        report["workflows"]["knowledgeBase"] = exercise_knowledge_base(session, outputs)

        _, deletion = api(outputs["ApiUrl"], "POST", "/me/deletion", citizen_token, {})
        deadline = time.time() + 120
        while time.time() < deadline:
            remaining = cognito.list_users(
                UserPoolId=outputs["UserPoolId"],
                Filter=f'email = "{citizen_name}"',
                Limit=1,
            ).get("Users", [])
            if not remaining:
                citizen_deleted = True
                break
            time.sleep(3)
        assert citizen_deleted
        report["workflows"]["accountAndDataDeletion"] = {
            "status": "PASS",
            "deletionJobAccepted": bool(deletion.get("jobId")),
            "cognitoUserRemoved": True,
        }
        report["completedAt"] = utc_now()
        report["overall"] = (
            "PASS_WITH_EXTERNAL_BEDROCK_BLOCKER"
            if report["workflows"]["knowledgeBase"].get("ingestion") in {"BLOCKED", "FAILED"}
            or report["workflows"]["knowledgeBase"].get("embeddingInvocation") == "BLOCKED"
            else "PASS"
        )
    finally:
        for username, owner_sub in users:
            if citizen_deleted and username == locals().get("citizen_name"):
                continue
            try:
                cognito.admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=username)
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") != "UserNotFoundException":
                    raise

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()

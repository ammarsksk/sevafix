from __future__ import annotations

import argparse
import base64
import hashlib
import json
import secrets
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import boto3


def stack_outputs(cf: Any, name: str) -> dict[str, str]:
    stack = cf.describe_stacks(StackName=name)["Stacks"][0]
    return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}


def api(url: str, method: str, path: str, token: str | None = None, body: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url.rstrip("/") + path, method=method, headers=headers, data=data)
    try:
        with urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except HTTPError as exc:
        payload = json.loads(exc.read() or b"{}")
        raise AssertionError(f"{method} {path} returned {exc.code}: {payload}") from exc


def wait_job(base: str, token: str, job_id: str, timeout: int = 60) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        _, job = api(base, "GET", f"/jobs/{job_id}", token)
        if job.get("status") in {"COMPLETED", "FAILED"}:
            assert job["status"] == "COMPLETED", job
            return job
        time.sleep(2)
    raise TimeoutError(f"job {job_id} did not finish")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--pdf", default="SevaFix — Government Application Companion (First Commit by AWS).pdf")
    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    out = stack_outputs(session.client("cloudformation"), args.stack)
    cognito = session.client("cognito-idp")
    username = f"smoke-{int(time.time())}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    result: dict[str, Any] = {}
    created = False
    owner_sub = None
    try:
        user = cognito.admin_create_user(UserPoolId=out["UserPoolId"], Username=username, UserAttributes=[{"Name": "email", "Value": username}, {"Name": "email_verified", "Value": "true"}], MessageAction="SUPPRESS")["User"]
        created = True
        owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
        cognito.admin_set_user_password(UserPoolId=out["UserPoolId"], Username=username, Password=password, Permanent=True)
        cognito.admin_add_user_to_group(UserPoolId=out["UserPoolId"], Username=username, GroupName="citizen")
        auth = cognito.initiate_auth(ClientId=out["UserPoolClientId"], AuthFlow="USER_PASSWORD_AUTH", AuthParameters={"USERNAME": username, "PASSWORD": password})
        token = auth["AuthenticationResult"]["IdToken"]

        status, health = api(out["ApiUrl"], "GET", "/health")
        assert status == 200 and health["status"] == "ok"
        _, schemes = api(out["ApiUrl"], "GET", "/schemes", token)
        assert any(s.get("schemeId") == "pm-usp-csss" for s in schemes["items"])
        _, application = api(out["ApiUrl"], "POST", "/applications", token, {"schemeId": "pm-usp-csss"})
        app_id = application["appId"]
        fields = {
            "student.primaryName": "Aditi Sharma", "student.familyAnnualIncomeINR": 350000,
            "student.enrolmentMode": "REGULAR", "student.courseType": "DEGREE",
            "student.receivesOtherScholarship": False, "student.boardPercentile": 91,
            "student.hasAcademicGap": False,
        }
        api(out["ApiUrl"], "PATCH", f"/applications/{app_id}/draft", token, {"fields": fields, "expectedRevision": 0})
        _, validation = api(out["ApiUrl"], "POST", f"/applications/{app_id}/validate", token, {})
        validation_job = wait_job(out["ApiUrl"], token, validation["jobId"])
        assert validation_job["result"]["summary"]["blocked"] >= 1
        _, version = api(out["ApiUrl"], "POST", f"/applications/{app_id}/versions", token, {})
        assert version["versionId"] == "v1"

        pdf = Path(args.pdf)
        data = pdf.read_bytes()
        assert len(data) <= 10 * 1024 * 1024
        digest = hashlib.sha256(data).hexdigest()
        _, upload = api(out["ApiUrl"], "POST", "/documents/uploads", token, {"applicationId": app_id, "documentType": "IDENTITY_PROOF", "contentType": "application/pdf", "size": len(data), "sha256": digest})
        put_headers = upload["requiredHeaders"]
        put_request = Request(upload["uploadUrl"], method="PUT", data=data, headers=put_headers)
        with urlopen(put_request, timeout=120) as response:
            assert response.status == 200
        api(out["ApiUrl"], "POST", f"/documents/{upload['documentId']}/complete", token, {})

        deadline = time.time() + 180
        document_state = None
        while time.time() < deadline:
            _, view = api(out["ApiUrl"], "GET", f"/applications/{app_id}", token)
            document = next(d for d in view["documents"] if d["documentId"] == upload["documentId"])
            document_state = document["state"]
            if document_state in {"EXTRACTED", "NEEDS_USER_CONFIRMATION", "OCR_FAILED_FINAL"}:
                break
            time.sleep(5)
        assert document_state in {"EXTRACTED", "NEEDS_USER_CONFIRMATION"}, document_state

        _, diagnosis = api(out["ApiUrl"], "POST", f"/applications/{app_id}/diagnoses", token, {"reasonText": "Rejected because family income does not match certificate"})
        diagnosis_job = wait_job(out["ApiUrl"], token, diagnosis["jobId"], timeout=120)
        assert diagnosis_job["result"]["category"] == "INCOME_MISMATCH"
        _, deletion = api(out["ApiUrl"], "POST", "/me/deletion", token, {})
        time.sleep(15)
        remaining = cognito.list_users(UserPoolId=out["UserPoolId"], Filter=f'email = "{username}"', Limit=1).get("Users", [])
        assert not remaining
        created = False
        result = {"health": "PASS", "auth": "PASS", "application": "PASS", "validation": "PASS", "versioning": "PASS", "uploadChecksum": "PASS", "textractPipeline": document_state, "diagnosis": "PASS", "deletion": "PASS", "appId": app_id, "documentId": upload["documentId"], "deletionJobId": deletion["jobId"]}
    finally:
        if created:
            try:
                function_name = session.client("cloudformation").describe_stack_resource(StackName=args.stack, LogicalResourceId="DeletionFunction")["StackResourceDetail"]["PhysicalResourceId"]
                session.client("lambda").invoke(FunctionName=function_name, InvocationType="RequestResponse", Payload=json.dumps({"ownerSub": owner_sub, "jobId": "smoke-cleanup"}).encode("utf-8"))
            except Exception:
                try:
                    cognito.admin_delete_user(UserPoolId=out["UserPoolId"], Username=username)
                except Exception:
                    pass
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

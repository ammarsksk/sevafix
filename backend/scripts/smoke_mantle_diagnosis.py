from __future__ import annotations

import argparse
import json
import secrets
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3

from smoke_live import api, stack_outputs, wait_job


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one deployed, cited Bedrock Mantle diagnosis.")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--model", default="openai.gpt-oss-20b")
    parser.add_argument("--artifact", default="artifacts/acceptance/mantle-diagnosis-latest.json")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    cognito = session.client("cognito-idp")
    username = f"mantle-smoke-{int(time.time())}-{secrets.token_hex(3)}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    created = False
    owner_sub: str | None = None
    report: dict[str, Any] = {"testedAt": utc_now(), "stack": args.stack, "region": args.region}

    try:
        user = cognito.admin_create_user(
            UserPoolId=outputs["UserPoolId"],
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": username},
                {"Name": "email_verified", "Value": "true"},
            ],
            MessageAction="SUPPRESS",
        )["User"]
        created = True
        owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
        cognito.admin_set_user_password(
            UserPoolId=outputs["UserPoolId"], Username=username, Password=password, Permanent=True
        )
        cognito.admin_add_user_to_group(
            UserPoolId=outputs["UserPoolId"], Username=username, GroupName="citizen"
        )
        auth = cognito.initiate_auth(
            ClientId=outputs["UserPoolClientId"],
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": username, "PASSWORD": password},
        )
        token = auth["AuthenticationResult"]["IdToken"]

        status, health = api(outputs["ApiUrl"], "GET", "/health")
        assert status == 200 and health.get("status") == "ok", health
        _, application = api(
            outputs["ApiUrl"], "POST", "/applications", token, {"schemeId": "pm-usp-csss"}
        )
        app_id = application["appId"]
        _, queued = api(
            outputs["ApiUrl"],
            "POST",
            f"/applications/{app_id}/diagnoses",
            token,
            {"reasonText": "The application was returned because family income does not match the income certificate."},
        )
        job = wait_job(outputs["ApiUrl"], token, queued["jobId"], timeout=150)
        result = job["result"]
        assert result.get("usedModelId") == args.model, result
        assert result.get("category") == "INCOME_MISMATCH", result
        assert result.get("citedSourceIds"), result
        assert result.get("citations"), result

        _, deletion = api(outputs["ApiUrl"], "POST", "/me/deletion", token, {})
        deadline = time.time() + 60
        while time.time() < deadline:
            remaining = cognito.list_users(
                UserPoolId=outputs["UserPoolId"], Filter=f'email = "{username}"', Limit=1
            ).get("Users", [])
            if not remaining:
                created = False
                break
            time.sleep(2)
        assert not created, "Temporary smoke-test user was not deleted"

        report.update(
            {
                "status": "PASS",
                "health": "PASS",
                "authentication": "PASS",
                "application": "PASS",
                "diagnosisJob": "PASS",
                "modelId": result["usedModelId"],
                "category": result["category"],
                "citationCount": len(result["citations"]),
                "citedSourceIds": result["citedSourceIds"],
                "temporaryUserDeletion": "PASS",
                "deletionJobId": deletion["jobId"],
            }
        )
    finally:
        if created:
            try:
                function_name = session.client("cloudformation").describe_stack_resource(
                    StackName=args.stack, LogicalResourceId="DeletionFunction"
                )["StackResourceDetail"]["PhysicalResourceId"]
                session.client("lambda").invoke(
                    FunctionName=function_name,
                    InvocationType="RequestResponse",
                    Payload=json.dumps({"ownerSub": owner_sub, "jobId": "mantle-smoke-cleanup"}).encode("utf-8"),
                )
            except Exception:
                try:
                    cognito.admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=username)
                except Exception:
                    pass

    artifact = Path(args.artifact)
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

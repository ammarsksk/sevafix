from __future__ import annotations

import json
import os
import secrets
import shutil
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

import boto3


ROOT = Path(__file__).resolve().parents[1]
STACK_NAME = "sevafix-dev"
PROFILE = "sevafix-deploy"
REGION = "ap-south-1"


def outputs(session: boto3.Session) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=STACK_NAME)["Stacks"][0]
    return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}


def main() -> None:
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    stack_outputs = outputs(session)
    cognito = session.client("cognito-idp")
    email = f"frontend-smoke-{int(time.time())}-{secrets.token_hex(3)}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    created = False
    owner_sub: str | None = None
    server: subprocess.Popen[str] | None = None

    try:
        user = cognito.admin_create_user(
            UserPoolId=stack_outputs["UserPoolId"],
            Username=email,
            UserAttributes=[{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"}],
            MessageAction="SUPPRESS",
        )["User"]
        created = True
        owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
        cognito.admin_set_user_password(UserPoolId=stack_outputs["UserPoolId"], Username=email, Password=password, Permanent=True)
        cognito.admin_add_user_to_group(UserPoolId=stack_outputs["UserPoolId"], Username=email, GroupName="citizen")
        cognito.admin_add_user_to_group(UserPoolId=stack_outputs["UserPoolId"], Username=email, GroupName="policy-reviewer")

        npm = shutil.which("npm.cmd") or "npm.cmd"
        server = subprocess.Popen(
            [npm, "run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 45
        while time.time() < deadline:
            try:
                with urlopen("http://127.0.0.1:3000/login", timeout=2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("Next.js server did not become ready")

        env = os.environ.copy()
        env.update({"SEVAFIX_TEST_EMAIL": email, "SEVAFIX_TEST_PASSWORD": password})
        subprocess.run(["node", "scripts/live-ui-smoke.mjs"], cwd=ROOT, env=env, check=True)

        deadline = time.time() + 60
        while time.time() < deadline:
            users = cognito.list_users(UserPoolId=stack_outputs["UserPoolId"], Filter=f'email = "{email}"', Limit=1).get("Users", [])
            if not users:
                created = False
                break
            time.sleep(2)
        if created:
            raise RuntimeError("Frontend account-deletion workflow did not remove the temporary Cognito user")
        print(json.dumps({"status": "PASS", "temporaryUserDeletion": "PASS"}, indent=2))
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
        if created:
            try:
                function_name = session.client("cloudformation").describe_stack_resource(
                    StackName=STACK_NAME, LogicalResourceId="DeletionFunction"
                )["StackResourceDetail"]["PhysicalResourceId"]
                session.client("lambda").invoke(
                    FunctionName=function_name,
                    InvocationType="RequestResponse",
                    Payload=json.dumps({"ownerSub": owner_sub, "jobId": "frontend-smoke-cleanup"}).encode(),
                )
            except Exception:
                try:
                    cognito.admin_delete_user(UserPoolId=stack_outputs["UserPoolId"], Username=email)
                except Exception:
                    pass


if __name__ == "__main__":
    main()

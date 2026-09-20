from __future__ import annotations

import json
import os
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

import boto3


FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent
STACK_NAME = "sevafix-dev"
PROFILE = "sevafix-deploy"
REGION = "ap-south-1"
PORT = 3000


def stack_outputs(session: boto3.Session) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=STACK_NAME)["Stacks"][0]
    return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}


def main() -> None:
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    outputs = stack_outputs(session)
    cognito = session.client("cognito-idp")
    email = f"full-mock-{int(time.time())}-{secrets.token_hex(3)}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    owner_sub: str | None = None
    server: subprocess.Popen[str] | None = None

    try:
        subprocess.run([sys.executable, str(ROOT / "backend" / "scripts" / "create_mock_documents.py")], cwd=ROOT, check=True)
        npm = shutil.which("npm.cmd") or "npm.cmd"
        subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)

        user = cognito.admin_create_user(
            UserPoolId=outputs["UserPoolId"],
            Username=email,
            UserAttributes=[{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"}],
            MessageAction="SUPPRESS",
        )["User"]
        owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
        cognito.admin_set_user_password(UserPoolId=outputs["UserPoolId"], Username=email, Password=password, Permanent=True)
        cognito.admin_add_user_to_group(UserPoolId=outputs["UserPoolId"], Username=email, GroupName="citizen")

        server = subprocess.Popen(
            [npm, "run", "start", "--", "--hostname", "localhost", "--port", str(PORT)],
            cwd=FRONTEND,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 45
        while time.time() < deadline:
            try:
                with urlopen(f"http://localhost:{PORT}/login", timeout=2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("Next.js demo server did not become ready")

        env = os.environ.copy()
        env.update(
            {
                "SEVAFIX_TEST_EMAIL": email,
                "SEVAFIX_TEST_PASSWORD": password,
                "SEVAFIX_FRONTEND_URL": f"http://localhost:{PORT}",
            }
        )
        subprocess.run(["node", "scripts/full-mock-run.mjs"], cwd=FRONTEND, env=env, check=True)
        print(json.dumps({"status": "PASS", "report": "artifacts/mock-run/mock-run-report.json"}, indent=2))
    finally:
        if server is not None:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(server.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
        if owner_sub:
            try:
                function_name = session.client("cloudformation").describe_stack_resource(
                    StackName=STACK_NAME, LogicalResourceId="DeletionFunction"
                )["StackResourceDetail"]["PhysicalResourceId"]
                response = session.client("lambda").invoke(
                    FunctionName=function_name,
                    InvocationType="RequestResponse",
                    Payload=json.dumps({"ownerSub": owner_sub, "jobId": "full-mock-cleanup"}).encode(),
                )
                payload = json.loads(response["Payload"].read() or b"{}")
                if response.get("FunctionError"):
                    raise RuntimeError(f"Demo cleanup failed: {payload}")
            except Exception:
                try:
                    cognito.admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=email)
                except Exception:
                    pass


if __name__ == "__main__":
    main()

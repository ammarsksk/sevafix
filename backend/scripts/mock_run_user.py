"""Create or remove a disposable Cognito citizen for a manual SevaFix mock run."""

from __future__ import annotations

import argparse
import json
import secrets
import time

import boto3


def stack_outputs(session, stack_name: str) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=stack_name)["Stacks"][0]
    return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}


def create(session, outputs: dict[str, str]) -> None:
    cognito = session.client("cognito-idp")
    email = f"mock-run-{int(time.time())}-{secrets.token_hex(3)}@example.invalid"
    password = f"Sv!{secrets.token_urlsafe(18)}9a"
    user = cognito.admin_create_user(
        UserPoolId=outputs["UserPoolId"],
        Username=email,
        UserAttributes=[
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "name", "Value": "Aarav Mehta"},
        ],
        MessageAction="SUPPRESS",
    )["User"]
    owner_sub = next(attribute["Value"] for attribute in user["Attributes"] if attribute["Name"] == "sub")
    cognito.admin_set_user_password(
        UserPoolId=outputs["UserPoolId"],
        Username=email,
        Password=password,
        Permanent=True,
    )
    cognito.admin_add_user_to_group(
        UserPoolId=outputs["UserPoolId"],
        Username=email,
        GroupName="citizen",
    )
    print(json.dumps({"email": email, "password": password, "ownerSub": owner_sub}))


def cleanup(session, outputs: dict[str, str], stack_name: str, email: str, owner_sub: str) -> None:
    deletion_function = session.client("cloudformation").describe_stack_resource(
        StackName=stack_name, LogicalResourceId="DeletionFunction"
    )["StackResourceDetail"]["PhysicalResourceId"]
    response = session.client("lambda").invoke(
        FunctionName=deletion_function,
        InvocationType="RequestResponse",
        Payload=json.dumps({"ownerSub": owner_sub, "jobId": f"mock-run-cleanup-{int(time.time())}"}).encode(),
    )
    payload = response["Payload"].read().decode() or "{}"
    users = session.client("cognito-idp").list_users(
        UserPoolId=outputs["UserPoolId"],
        Filter=f'email = "{email}"',
        Limit=1,
    ).get("Users", [])
    if users:
        session.client("cognito-idp").admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=email)
    print(json.dumps({"cleanup": "complete", "lambdaResponse": json.loads(payload)}))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("create", "cleanup"))
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--email")
    parser.add_argument("--owner-sub")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session, args.stack)
    if args.action == "create":
        create(session, outputs)
        return
    if not args.email or not args.owner_sub:
        parser.error("cleanup requires --email and --owner-sub")
    cleanup(session, outputs, args.stack, args.email, args.owner_sub)


if __name__ == "__main__":
    main()

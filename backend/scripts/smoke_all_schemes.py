from __future__ import annotations

import argparse
import json
import time
from decimal import Decimal
from pathlib import Path
from typing import Any

import boto3

from acceptance_live import api, create_user, stack_outputs, utc_now, wait_job


def demo_fields(scheme: dict[str, Any], rules: list[dict[str, Any]]) -> dict[str, Any]:
    def plain(value: Any) -> Any:
        if isinstance(value, Decimal):
            return int(value) if value == value.to_integral_value() else float(value)
        if isinstance(value, list):
            return [plain(item) for item in value]
        return value

    values: dict[str, Any] = {}
    by_key = {rule["assert"]["field"]: rule["assert"] for rule in rules}
    for section in scheme["formSchema"]["sections"]:
        for field in section["fields"]:
            assertion = by_key.get(field["key"])
            if assertion:
                operation = assertion["op"]
                expected = assertion.get("value")
                if operation in {"EQ", "GTE", "LTE"}:
                    values[field["key"]] = plain(expected)
                    continue
                if operation == "IN":
                    values[field["key"]] = plain(expected[0])
                    continue
            if field["type"] == "boolean":
                values[field["key"]] = True
            elif field["type"] in {"integer", "number"}:
                values[field["key"]] = plain(field.get("minimum", 1))
            elif field["type"] == "select":
                option = field["options"][0]
                values[field["key"]] = option if isinstance(option, str) else option["value"]
            else:
                values[field["key"]] = "Synthetic test value"
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Exercise create, draft, and validation for every active scheme")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--report", type=Path, default=Path("artifacts/all-schemes-smoke.json"))
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session, args.stack)
    table = session.resource("dynamodb").Table(outputs["TableName"])
    cognito = session.client("cognito-idp")
    username = owner_sub = ""
    report: dict[str, Any] = {"startedAt": utc_now(), "schemes": []}
    deletion_requested = False
    try:
        username, owner_sub, token = create_user(cognito, outputs["UserPoolId"], outputs["UserPoolClientId"], "citizen")
        _, catalog = api(outputs["ApiUrl"], "GET", "/schemes", token)
        assert len(catalog["items"]) == 10
        assert all(item.get("applicationReady") is True for item in catalog["items"])
        for scheme in sorted(catalog["items"], key=lambda item: item["schemeId"]):
            version_id = scheme["activePolicyVersionId"]
            rules = table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
                ExpressionAttributeValues={":pk": f"RULESET#{version_id}", ":prefix": "RULE#"},
                ConsistentRead=True,
            )["Items"]
            assert rules, f"No rules for {scheme['schemeId']}"
            assert scheme.get("formSchema", {}).get("sections"), f"No form schema for {scheme['schemeId']}"
            assert scheme.get("documentChecklist"), f"No document checklist for {scheme['schemeId']}"
            _, created = api(outputs["ApiUrl"], "POST", "/applications", token, {"schemeId": scheme["schemeId"]})
            assert created["policyVersionId"] == version_id
            fields = demo_fields(scheme, rules)
            api(outputs["ApiUrl"], "PATCH", f"/applications/{created['appId']}/draft", token, {"fields": fields, "expectedRevision": 0})
            _, queued = api(outputs["ApiUrl"], "POST", f"/applications/{created['appId']}/validate", token, {})
            completed = wait_job(outputs["ApiUrl"], token, queued["jobId"])
            summary = completed["result"]["summary"]
            assert 0 < summary["applicable"] <= len(rules), (scheme["schemeId"], summary, len(rules))
            report["schemes"].append({
                "schemeId": scheme["schemeId"], "policyVersionId": version_id,
                "rules": len(rules), "formFields": len(fields), "validation": summary,
            })

        _, deletion = api(outputs["ApiUrl"], "POST", "/me/deletion", token, {})
        deletion_requested = bool(deletion.get("jobId"))
        deadline = time.time() + 120
        while time.time() < deadline:
            users = cognito.list_users(UserPoolId=outputs["UserPoolId"], Filter=f'email = "{username}"', Limit=1).get("Users", [])
            if not users:
                break
            time.sleep(3)
        assert not users
        report.update({"completedAt": utc_now(), "status": "PASS", "temporaryUserDeleted": True})
    finally:
        if username and not deletion_requested:
            try:
                cognito.admin_delete_user(UserPoolId=outputs["UserPoolId"], Username=username)
            except cognito.exceptions.UserNotFoundException:
                pass

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()

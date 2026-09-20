from __future__ import annotations

import argparse
import json

import boto3
from boto3.dynamodb.conditions import Key


EXPECTED_SCHEME_IDS = {
    "pm-usp-csss",
    "pm-kisan",
    "ab-pmjay",
    "pmuy",
    "pmay-u-2",
    "pmay-g",
    "pm-svanidhi",
    "pmmvy",
    "nsap",
    "pm-vishwakarma",
}

EXPECTED_DATA_GOV_SOURCES = {
    "pm-kisan-data-gov-catalog",
    "pmuy-data-gov-catalog",
    "pmay-g-data-gov-catalog",
    "nsap-data-gov-catalog",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify the deployed scheme and source catalog.")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--invoke-monitor", action="store_true")
    parser.add_argument("--show-errors", action="store_true")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    stack = session.client("cloudformation").describe_stacks(StackName=args.stack)["Stacks"][0]
    outputs = {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}
    table = session.resource("dynamodb").Table(outputs["TableName"])

    schemes = table.query(
        KeyConditionExpression=Key("PK").eq("CATALOG#SCHEMES") & Key("SK").begins_with("SCHEME#")
    )["Items"]
    sources = table.query(
        KeyConditionExpression=Key("PK").eq("SOURCES#REGISTRY") & Key("SK").begins_with("SOURCE#")
    )["Items"]

    scheme_ids = {item["schemeId"] for item in schemes}
    assert scheme_ids == EXPECTED_SCHEME_IDS, f"Unexpected scheme IDs: {sorted(scheme_ids)}"
    not_ready = [item["schemeId"] for item in schemes if item.get("applicationReady") is not True]
    assert not not_ready, f"Schemes without an application workflow: {sorted(not_ready)}"
    missing_versions = [item["schemeId"] for item in schemes if not item.get("activePolicyVersionId")]
    assert not missing_versions, f"Schemes without an active policy version: {sorted(missing_versions)}"

    data_gov_sources = [item for item in sources if item.get("sourceKind") == "DATA_GOV_API"]
    data_gov_source_ids = {item["sourceId"] for item in data_gov_sources}
    assert EXPECTED_DATA_GOV_SOURCES.issubset(data_gov_source_ids)
    assert all("api-key" not in item["url"] for item in data_gov_sources)

    function = session.client("lambda").get_function_configuration(
        FunctionName=f"sevafix-{args.stack.removeprefix('sevafix-')}-source-monitor"
    )
    data_gov_key_configured = bool(function.get("Environment", {}).get("Variables", {}).get("DATA_GOV_API_KEY"))
    assert data_gov_key_configured, "DATA_GOV_API_KEY is not configured on the source monitor"

    print(f"Stack status: {stack['StackStatus']}")
    print(f"Schemes verified: {len(schemes)}")
    print("Application-ready schemes: all")
    print(f"Data.gov.in sources verified: {len(EXPECTED_DATA_GOV_SOURCES)}")
    print("Stored API URLs contain keys: no")
    print("Source-monitor API key configured: yes")

    if args.show_errors:
        for source in sorted(sources, key=lambda item: item["sourceId"]):
            if source.get("lastError"):
                print(f"Failed source {source['sourceId']}: {source['lastError']}")

    if args.invoke_monitor:
        response = session.client("lambda").invoke(
            FunctionName=f"sevafix-{args.stack.removeprefix('sevafix-')}-source-monitor",
            InvocationType="RequestResponse",
            Payload=b"{}",
        )
        result = json.loads(response["Payload"].read())
        assert "FunctionError" not in response, result
        print(
            "Source monitor: "
            f"checked={result.get('checked')} changed={result.get('changed')} failed={result.get('failed')}"
        )
        if result.get("failed"):
            refreshed_sources = table.query(
                KeyConditionExpression=Key("PK").eq("SOURCES#REGISTRY") & Key("SK").begins_with("SOURCE#")
            )["Items"]
            for source in sorted(refreshed_sources, key=lambda item: item["sourceId"]):
                if source.get("lastError"):
                    print(f"Failed source {source['sourceId']}: {source['lastError']}")
            raise AssertionError(result)


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from common.scheme_packages import SCHEME_PACKAGES  # noqa: E402


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def outputs(session: boto3.Session, stack: str) -> dict[str, str]:
    values = session.client("cloudformation").describe_stacks(StackName=stack)["Stacks"][0].get("Outputs", [])
    return {item["OutputKey"]: item["OutputValue"] for item in values}


def policy_markdown(item: dict[str, Any], checked_at: str) -> str:
    checks = "\n".join(f"- {rule['title']}" for rule in item["rules"])
    notes = "\n".join(f"- {note}" for note in item["notes"])
    return f"""# {item['name']} — SevaFix pre-check package

Policy version: `{item['policyVersionId']}`  
Official authority: {item['authority']}  
Official source: {item['source']['url']}  
Checked for publication: {checked_at[:10]}

## Important boundary

{item['disclaimer']}

## Source-grounded pre-checks

{checks}

## Operational notes

{notes}

The official portal and competent authority remain authoritative. A SevaFix pass means only
that the supplied answers and evidence passed this package's limited checks; it is not an
approval, entitlement, submission receipt, or guarantee of benefit.
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish pre-check packages for all catalog schemes")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default=os.getenv("AWS_PROFILE", "sevafix-deploy"))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--scheme", action="append", dest="schemes", help="Publish only this scheme ID (repeatable)")
    parser.add_argument("--skip-ingestion", action="store_true")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    stack_outputs = outputs(session, args.stack)
    table = session.resource("dynamodb").Table(stack_outputs["TableName"])
    main_s3 = session.client("s3")
    targets: list[tuple[Any, str]] = [(main_s3, stack_outputs["PolicyBucketName"])]
    kb_region = stack_outputs.get("KnowledgeBaseRegion", args.region)
    kb_bucket = stack_outputs.get("KnowledgeBasePolicyBucketName")
    if kb_bucket and kb_bucket != stack_outputs["PolicyBucketName"]:
        targets.append((session.client("s3", region_name=kb_region), kb_bucket))

    timestamp = now()
    published: list[dict[str, Any]] = []
    selected = [item for item in SCHEME_PACKAGES if not args.schemes or item["schemeId"] in args.schemes]
    if args.schemes and len(selected) != len(set(args.schemes)):
        known = {item["schemeId"] for item in SCHEME_PACKAGES}
        raise ValueError(f"Unknown scheme IDs: {sorted(set(args.schemes).difference(known))}")
    for item in selected:
        scheme_id = item["schemeId"]
        version_id = item["policyVersionId"]
        policy = policy_markdown(item, timestamp).encode("utf-8")
        package_hash = hashlib.sha256(json.dumps(item, sort_keys=True).encode("utf-8") + policy).hexdigest()
        policy_key = f"published/{scheme_id}/{version_id}/policy.md"
        metadata = {"metadataAttributes": {
            "schemeId": scheme_id,
            "policyVersionId": version_id,
            "reviewState": "PUBLISHED",
            "authority": item["authority"],
            "sourceId": item["source"]["sourceId"],
        }}
        for client, bucket in targets:
            client.put_object(Bucket=bucket, Key=policy_key, Body=policy, ContentType="text/markdown")
            client.put_object(Bucket=bucket, Key=f"{policy_key}.metadata.json", Body=json.dumps(metadata).encode("utf-8"), ContentType="application/json")

        version = {
            "PK": f"POLICY#{scheme_id}", "SK": f"VERSION#{version_id}", "entityType": "PolicyVersion",
            "schemeId": scheme_id, "policyVersionId": version_id, "status": "PUBLISHED",
            "effectiveFrom": timestamp[:10], "verifiedAt": timestamp, "engineVersion": "rules-engine@1.0.0",
            "dataQuality": "SOURCE_GROUNDED_CONSERVATIVE_PRECHECK", "sourceIds": [item["source"]["sourceId"]],
            "policyS3Key": policy_key, "packageHash": package_hash, "publishedAt": timestamp,
            "publishedBy": "scheme-catalog-loader", "auditReason": "Activate conservative official-source pre-check workflow",
        }
        table.put_item(Item=version)
        for check in item["rules"]:
            table.put_item(Item={
                "PK": f"RULESET#{version_id}", "SK": f"RULE#{check['ruleId']}", "entityType": "Rule",
                "policyVersionId": version_id, "packageHash": package_hash, **check,
            })

        scheme = {key: value for key, value in item.items() if key not in {"rules", "notes", "source", "policyVersionId"}}
        scheme.update({
            "PK": f"SCHEME#{scheme_id}", "SK": "META", "entityType": "Scheme",
            "activePolicyVersionId": version_id, "policyPackageHash": package_hash, "updatedAt": timestamp,
        })
        table.put_item(Item=scheme)
        table.put_item(Item={**scheme, "PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme_id}"})
        table.put_item(Item={
            "PK": "SOURCES#REGISTRY", "SK": f"SOURCE#{item['source']['sourceId']}",
            "entityType": "OfficialSource", "schemeId": scheme_id, "enabled": True,
            "registeredAt": timestamp, "verifiedAt": timestamp, "packageHash": package_hash, **item["source"],
        })
        table.put_item(Item={
            "PK": f"POLICY#{scheme_id}", "SK": f"AUDIT#{timestamp}#catalog-activation",
            "entityType": "PolicyAudit", "action": "POLICY_PACKAGE_PUBLISHED", "policyVersionId": version_id,
            "actor": "scheme-catalog-loader", "reason": "Source-grounded conservative pre-check activated",
            "packageHash": package_hash, "createdAt": timestamp,
        })
        published.append({"schemeId": scheme_id, "policyVersionId": version_id, "rules": len(item["rules"])})

    ingestion_job_id = None
    ingestion_error = None
    if not args.skip_ingestion and stack_outputs.get("KnowledgeBaseId") and stack_outputs.get("KnowledgeBaseDataSourceId"):
        try:
            ingestion_job_id = session.client("bedrock-agent", region_name=kb_region).start_ingestion_job(
                knowledgeBaseId=stack_outputs["KnowledgeBaseId"],
                dataSourceId=stack_outputs["KnowledgeBaseDataSourceId"],
                description=f"All scheme pre-check packages {timestamp[:10]}",
            )["ingestionJob"]["ingestionJobId"]
        except ClientError as exc:
            error = exc.response.get("Error", {})
            ingestion_error = f"{error.get('Code')}: {error.get('Message')}"

    print(json.dumps({"published": published, "ingestionJobId": ingestion_job_id, "ingestionError": ingestion_error}, indent=2))


if __name__ == "__main__":
    main()

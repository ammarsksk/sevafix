from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError


DEFAULT_PACKAGE = Path(__file__).resolve().parents[1] / "data" / "pm-usp-csss-2026-27.3"
RULE_OPERATORS = {"PRESENT", "EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NOT_IN", "DATE_BETWEEN", "NAME_SIMILAR"}
TRUSTED_HOSTS = {"scholarships.gov.in", "www.education.gov.in", "education.gov.in"}
MAX_SOURCE_BYTES = 15 * 1024 * 1024
LEGACY_SOURCE_REPLACEMENTS = {
    "education-csss-page": "education-scholarships-page",
    "nsp-portal": "nsp-scheme-list-2026-27",
}


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() in {"script", "style", "svg", "noscript"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in {"script", "style", "svg", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def content_digest(body: bytes, content_type: str) -> str:
    if "html" not in content_type.casefold():
        return hashlib.sha256(body).hexdigest()
    parser = VisibleTextParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    visible = " ".join(" ".join(parser.parts).split()).casefold()
    return hashlib.sha256(visible.encode("utf-8")).hexdigest()


def load_package(package_dir: Path) -> tuple[dict[str, Any], str]:
    manifest = json.loads((package_dir / "manifest.json").read_text(encoding="utf-8"))
    policy_text = (package_dir / "policy.md").read_text(encoding="utf-8")
    validate_package(manifest, policy_text)
    return manifest, policy_text


def validate_package(manifest: dict[str, Any], policy_text: str) -> None:
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported policy package schemaVersion")
    scheme = manifest["scheme"]
    version = manifest["policyVersion"]
    if not scheme.get("schemeId") or not version.get("policyVersionId"):
        raise ValueError("schemeId and policyVersionId are required")
    if scheme.get("status") != "ACTIVE" or version.get("status") != "PUBLISHED":
        raise ValueError("The verified package must contain an active scheme and published policy")
    if len(policy_text.strip()) < 1000:
        raise ValueError("Reviewed policy text is unexpectedly short")

    sources = manifest.get("sources", [])
    source_ids = [source["sourceId"] for source in sources]
    if len(source_ids) < 3 or len(source_ids) != len(set(source_ids)):
        raise ValueError("At least three unique official sources are required")
    for source in sources:
        parsed = urlparse(source["url"])
        if parsed.scheme != "https" or parsed.hostname not in TRUSTED_HOSTS:
            raise ValueError(f"Untrusted or non-HTTPS source: {source['url']}")

    field_keys = {
        field["key"]
        for section in scheme.get("formSchema", {}).get("sections", [])
        for field in section.get("fields", [])
    }
    if len(field_keys) < 10:
        raise ValueError("Form schema does not contain the expected policy fields")
    document_types = {
        document["documentType"]
        for documents in scheme.get("documentChecklist", {}).values()
        for document in documents
    }
    checklist_types = {
        application_type: {document["documentType"] for document in documents}
        for application_type, documents in scheme.get("documentChecklist", {}).items()
    }

    rule_ids: set[str] = set()
    for rule in manifest.get("rules", []):
        rule_id = rule.get("ruleId")
        assertion = rule.get("assert", {})
        if not rule_id or rule_id in rule_ids:
            raise ValueError(f"Missing or duplicate ruleId: {rule_id}")
        rule_ids.add(rule_id)
        if assertion.get("op") not in RULE_OPERATORS:
            raise ValueError(f"Unsupported rule operator in {rule_id}")
        assert_field = assertion.get("field")
        if assert_field not in field_keys and not str(assert_field).startswith("document."):
            raise ValueError(f"Unknown rule field {assert_field} in {rule_id}")
        condition = rule.get("appliesWhen")
        if condition and condition.get("field") not in field_keys:
            raise ValueError(f"Unknown condition field in {rule_id}")
        unknown_evidence = set(rule.get("requiredEvidence", [])).difference(document_types)
        if unknown_evidence:
            raise ValueError(f"Unknown evidence in {rule_id}: {sorted(unknown_evidence)}")
        applicable_types = set(scheme.get("supportedApplicationTypes", []))
        if condition and condition.get("field") == "application.type" and condition.get("op") == "EQ":
            applicable_types = {str(condition.get("value"))}
        for application_type in applicable_types:
            missing_from_checklist = set(rule.get("requiredEvidence", [])).difference(
                checklist_types.get(application_type, set())
            )
            if missing_from_checklist:
                raise ValueError(
                    f"Rule {rule_id} requires evidence absent from the {application_type} checklist: "
                    f"{sorted(missing_from_checklist)}"
                )
        unknown_sources = set(rule.get("sourceRefs", [])).difference(source_ids)
        if unknown_sources:
            raise ValueError(f"Unknown source references in {rule_id}: {sorted(unknown_sources)}")

    if not 8 <= len(rule_ids) <= 20:
        raise ValueError("Verified policy must contain between 8 and 20 deterministic rules")
    if any("deadline" in rule_id for rule_id in rule_ids):
        raise ValueError("Conflicting live deadline must not be encoded as an executable rule")

    claim_ids: set[str] = set()
    for claim in manifest.get("claims", []):
        if claim["claimId"] in claim_ids or claim["sourceId"] not in source_ids:
            raise ValueError("Policy claim IDs and source references must be valid")
        claim_ids.add(claim["claimId"])


def stack_outputs(session: boto3.Session, stack_name: str) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=stack_name)["Stacks"][0]
    return {entry["OutputKey"]: entry["OutputValue"] for entry in stack.get("Outputs", [])}


def fetch_source(source: dict[str, Any]) -> tuple[bytes, str, str]:
    request = Request(
        source["url"],
        headers={"User-Agent": "SevaFix-Verified-Policy-Loader/1.0", "Accept": "application/pdf,text/html,text/plain,*/*"},
    )
    with urlopen(request, timeout=30) as response:
        body = response.read(MAX_SOURCE_BYTES + 1)
        content_type = response.headers.get_content_type()
        final_host = urlparse(response.geturl()).hostname
    if len(body) > MAX_SOURCE_BYTES:
        raise ValueError(f"Source exceeds {MAX_SOURCE_BYTES} bytes: {source['sourceId']}")
    if final_host not in TRUSTED_HOSTS:
        raise ValueError(f"Source redirected to an untrusted host: {final_host}")
    if source.get("expectedContentType") == "application/pdf" and not body.startswith(b"%PDF"):
        raise ValueError(f"Official PDF source did not return a PDF: {source['sourceId']}")
    return body, content_type, content_digest(body, content_type)


def put_immutable(table: Any, item: dict[str, Any], package_hash: str) -> str:
    current = table.get_item(Key={"PK": item["PK"], "SK": item["SK"]}, ConsistentRead=True).get("Item")
    if current:
        if current.get("packageHash") != package_hash:
            raise RuntimeError(f"Immutable record already exists with different content: {item['PK']} / {item['SK']}")
        return "unchanged"
    table.put_item(Item={**item, "packageHash": package_hash}, ConditionExpression="attribute_not_exists(PK)")
    return "created"


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the reviewed PM-USP CSSS policy package")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default=os.getenv("AWS_PROFILE", "sevafix-deploy"))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--package", type=Path, default=DEFAULT_PACKAGE)
    parser.add_argument("--skip-ingestion", action="store_true")
    args = parser.parse_args()

    manifest, policy_text = load_package(args.package)
    package_hash = canonical_hash({"manifest": manifest, "policyText": policy_text})
    scheme_data = manifest["scheme"]
    version_data = manifest["policyVersion"]
    scheme_id = scheme_data["schemeId"]
    version_id = version_data["policyVersionId"]
    timestamp = now()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session, args.stack)
    table = session.resource("dynamodb").Table(outputs["TableName"])
    s3 = session.client("s3")
    policy_targets: list[tuple[Any, str]] = [(s3, outputs["PolicyBucketName"])]
    knowledge_bucket = outputs.get("KnowledgeBasePolicyBucketName")
    knowledge_region = outputs.get("KnowledgeBaseRegion", args.region)
    if knowledge_bucket and knowledge_bucket != outputs["PolicyBucketName"]:
        policy_targets.append((session.client("s3", region_name=knowledge_region), knowledge_bucket))

    def upload_policy_object(*, key: str, body: bytes, content_type: str) -> None:
        for client, bucket in policy_targets:
            client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)

    fetched: dict[str, dict[str, Any]] = {}
    for source in manifest["sources"]:
        body, content_type, digest = fetch_source(source)
        fetched[source["sourceId"]] = {
            "body": body,
            "contentType": content_type,
            "contentSha256": digest,
            "byteLength": len(body),
        }

    policy_key = f"published/{scheme_id}/{version_id}/policy.md"
    metadata_attributes = {
        "schemeId": scheme_id,
        "policyVersionId": version_id,
        "reviewState": "PUBLISHED",
        "authority": scheme_data["authority"],
        "verifiedAt": version_data["verifiedAt"],
    }
    upload_policy_object(key=policy_key, body=policy_text.encode("utf-8"), content_type="text/markdown")
    upload_policy_object(
        key=f"{policy_key}.metadata.json",
        body=json.dumps({"metadataAttributes": metadata_attributes}, ensure_ascii=False).encode("utf-8"),
        content_type="application/json",
    )

    artifact_keys: list[str] = []
    for source in manifest["sources"]:
        fetched_source = fetched[source["sourceId"]]
        if source.get("artifactInKnowledgeBase"):
            extension = ".pdf" if fetched_source["body"].startswith(b"%PDF") else ".html"
            key = f"published/{scheme_id}/{version_id}/sources/{source['sourceId']}{extension}"
            artifact_keys.append(key)
            upload_policy_object(key=key, body=fetched_source["body"], content_type=fetched_source["contentType"])
            source_metadata = {
                "metadataAttributes": {
                    **metadata_attributes,
                    "sourceId": source["sourceId"],
                    "sourceType": source["sourceType"],
                }
            }
            upload_policy_object(
                key=f"{key}.metadata.json",
                body=json.dumps(source_metadata, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
            )

    source_ids = [source["sourceId"] for source in manifest["sources"]]
    policy_item = {
        "PK": f"POLICY#{scheme_id}",
        "SK": f"VERSION#{version_id}",
        "entityType": "PolicyVersion",
        "schemeId": scheme_id,
        **version_data,
        "sourceIds": source_ids,
        "policyS3Key": policy_key,
        "sourceArtifactKeys": artifact_keys,
        "publishedAt": timestamp,
        "publishedBy": "verified-seed-loader",
        "auditReason": "Verified against official Ministry of Education and NSP sources",
    }
    created = 0
    unchanged = 0
    for item in [policy_item]:
        result = put_immutable(table, item, package_hash)
        created += result == "created"
        unchanged += result == "unchanged"
    for rule in manifest["rules"]:
        item = {
            "PK": f"RULESET#{version_id}",
            "SK": f"RULE#{rule['ruleId']}",
            "entityType": "Rule",
            "policyVersionId": version_id,
            **rule,
        }
        result = put_immutable(table, item, package_hash)
        created += result == "created"
        unchanged += result == "unchanged"
    for claim in manifest["claims"]:
        item = {
            "PK": f"POLICY#{scheme_id}",
            "SK": f"CLAIM#{version_id}#{claim['claimId']}",
            "entityType": "PolicyClaim",
            "policyVersionId": version_id,
            **claim,
        }
        result = put_immutable(table, item, package_hash)
        created += result == "created"
        unchanged += result == "unchanged"

    scheme_item = {
        "PK": f"SCHEME#{scheme_id}",
        "SK": "META",
        "entityType": "Scheme",
        **scheme_data,
        "activePolicyVersionId": version_id,
        "policyPackageHash": package_hash,
        "updatedAt": timestamp,
    }
    catalog_item = {**scheme_item, "PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme_id}"}
    table.put_item(Item=scheme_item)
    table.put_item(Item=catalog_item)

    for source in manifest["sources"]:
        fetched_source = fetched[source["sourceId"]]
        table.put_item(
            Item={
                "PK": "SOURCES#REGISTRY",
                "SK": f"SOURCE#{source['sourceId']}",
                "entityType": "OfficialSource",
                "schemeId": scheme_id,
                "enabled": True,
                **source,
                "contentSha256": fetched_source["contentSha256"],
                "observedSha256": fetched_source["contentSha256"],
                "contentType": fetched_source["contentType"],
                "byteLength": fetched_source["byteLength"],
                "lastCheckedAt": timestamp,
                "lastHttpStatus": 200,
                "lastError": "",
                "verifiedAt": timestamp,
                "packageHash": package_hash,
            }
        )

    # Keep historical source records for auditability, but do not monitor the
    # broad legacy URLs after their page-specific replacements are verified.
    for legacy_source_id, replacement_source_id in LEGACY_SOURCE_REPLACEMENTS.items():
        table.update_item(
            Key={"PK": "SOURCES#REGISTRY", "SK": f"SOURCE#{legacy_source_id}"},
            UpdateExpression="SET enabled=:disabled, supersededBy=:replacement, supersededAt=:now",
            ExpressionAttributeValues={
                ":disabled": False,
                ":replacement": replacement_source_id,
                ":now": timestamp,
            },
            ConditionExpression="attribute_exists(PK)",
        )

    audit_item = {
        "PK": f"POLICY#{scheme_id}",
        "SK": f"AUDIT#{timestamp}#verified-seed",
        "entityType": "PolicyAudit",
        "action": "VERIFIED_DATA_LOAD",
        "policyVersionId": version_id,
        "actor": "verified-seed-loader",
        "reason": "Official sources fetched, hashed, validated, and loaded",
        "packageHash": package_hash,
        "createdAt": timestamp,
    }
    table.put_item(Item=audit_item)

    ingestion_job_id = None
    ingestion_error = None
    if not args.skip_ingestion and outputs.get("KnowledgeBaseId") and outputs.get("KnowledgeBaseDataSourceId"):
        try:
            ingestion_job_id = session.client("bedrock-agent", region_name=knowledge_region).start_ingestion_job(
                knowledgeBaseId=outputs["KnowledgeBaseId"],
                dataSourceId=outputs["KnowledgeBaseDataSourceId"],
                description=f"Verified package {version_id} {package_hash[:12]}",
            )["ingestionJob"]["ingestionJobId"]
        except ClientError as exc:
            ingestion_error = f"{exc.response.get('Error', {}).get('Code')}: {exc.response.get('Error', {}).get('Message')}"

    result = {
        "seeded": True,
        "schemeId": scheme_id,
        "policyVersionId": version_id,
        "packageHash": package_hash,
        "rules": len(manifest["rules"]),
        "claims": len(manifest["claims"]),
        "sources": len(manifest["sources"]),
        "immutableRecordsCreated": created,
        "immutableRecordsUnchanged": unchanged,
        "policyKey": policy_key,
        "sourceArtifactKeys": artifact_keys,
        "ingestionJobId": ingestion_job_id,
        "ingestionError": ingestion_error,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"verified seed failed: {exc}", file=sys.stderr)
        raise

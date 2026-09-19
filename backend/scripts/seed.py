from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import boto3


SCHEME_ID = "pm-usp-csss"
POLICY_VERSION = "pm-usp-csss-2025-26.1"

SOURCES = [
    {
        "sourceId": "education-csss-page",
        "title": "Central Sector Scheme of Scholarship for College and University Students",
        "url": "https://www.education.gov.in/en/scholarships-education-loan-0",
        "authority": "Ministry of Education, Government of India",
    },
    {
        "sourceId": "nsp-portal",
        "title": "National Scholarship Portal",
        "url": "https://scholarships.gov.in/",
        "authority": "National Informatics Centre / Government of India",
    },
]

RULES: list[dict[str, Any]] = [
    {
        "ruleId": "family-income-cap", "title": "Family income must not exceed INR 4.5 lakh",
        "severity": "BLOCKING", "requiredEvidence": ["INCOME_CERTIFICATE"],
        "assert": {"field": "student.familyAnnualIncomeINR", "op": "LTE", "value": 450000},
        "messageKey": "income_cap", "sourceRefs": ["education-csss-page"],
    },
    {
        "ruleId": "regular-course", "title": "Student must be enrolled in a regular course",
        "severity": "BLOCKING", "requiredEvidence": ["ADMISSION_LETTER"],
        "assert": {"field": "student.enrolmentMode", "op": "EQ", "value": "REGULAR"},
        "messageKey": "regular_course", "sourceRefs": ["education-csss-page"],
    },
    {
        "ruleId": "not-diploma", "title": "Diploma courses are not eligible",
        "severity": "BLOCKING", "assert": {"field": "student.courseType", "op": "NOT_IN", "value": ["DIPLOMA"]},
        "messageKey": "not_diploma", "sourceRefs": ["education-csss-page"],
    },
    {
        "ruleId": "no-other-scholarship", "title": "Student must not receive another scholarship or fee reimbursement",
        "severity": "BLOCKING", "assert": {"field": "student.receivesOtherScholarship", "op": "EQ", "value": False},
        "messageKey": "no_other_scholarship", "sourceRefs": ["education-csss-page"],
    },
    {
        "ruleId": "board-percentile", "title": "Student must be above the 80th percentile in the relevant board stream",
        "severity": "BLOCKING", "requiredEvidence": ["MARKSHEET"],
        "assert": {"field": "student.boardPercentile", "op": "GTE", "value": 80},
        "messageKey": "board_percentile", "sourceRefs": ["education-csss-page"],
    },
    {
        "ruleId": "name-consistency", "title": "Applicant name should match supporting documents",
        "severity": "BLOCKING", "requiredEvidence": ["IDENTITY_PROOF"],
        "assert": {"field": "student.primaryName", "op": "NAME_SIMILAR", "otherField": "document.primaryName"},
        "messageKey": "name_consistency", "sourceRefs": ["nsp-portal"],
    },
    {
        "ruleId": "no-academic-gap", "title": "Application should be for the current continuous course year",
        "severity": "ADVISORY", "assert": {"field": "student.hasAcademicGap", "op": "EQ", "value": False},
        "messageKey": "academic_gap", "sourceRefs": ["education-csss-page"],
    },
]

POLICY_TEXT = """# PM-USP Central Sector Scheme of Scholarship - SevaFix policy snapshot

Policy version: pm-usp-csss-2025-26.1
Scheme ID: pm-usp-csss
Status: reviewer-approved seed for the development environment.

This snapshot converts official scheme guidance into deterministic pre-submission checks. The issuing authority and the National Scholarship Portal remain authoritative; SevaFix does not submit or approve applications.

## Eligibility checks

- The annual family income ceiling used by this policy version is INR 4,50,000.
- The student must pursue a regular course and diploma courses are excluded.
- The student must not receive another scholarship or fee reimbursement.
- The merit condition requires the student to be above the 80th percentile of successful candidates in the relevant Class XII board stream. A typed number alone is not sufficient: official marksheet/board evidence is required.
- Applicant identity details should be consistent with uploaded evidence and the National Scholarship Portal record.
- An academic gap is flagged for review because renewal/current-year conditions can depend on continuity and academic progress.

## Evidence expected by SevaFix

Income certificate, admission letter, Class XII marksheet or official board evidence, and identity proof. Low-confidence OCR is never silently treated as verified; it is sent for user confirmation.

## Sources

1. Ministry of Education scholarship/education-loan page: https://www.education.gov.in/en/scholarships-education-loan-0
2. National Scholarship Portal: https://scholarships.gov.in/

The source monitor records content changes but does not automatically publish new rules. A policy reviewer must approve a new immutable policy version.
"""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def outputs(cf: Any, stack_name: str) -> dict[str, str]:
    stack = cf.describe_stacks(StackName=stack_name)["Stacks"][0]
    return {o["OutputKey"]: o["OutputValue"] for o in stack.get("Outputs", [])}


def source_hash(url: str) -> str | None:
    try:
        with urlopen(Request(url, headers={"User-Agent": "SevaFix-Policy-Seed/1.0"}), timeout=15) as response:
            body = response.read(15 * 1024 * 1024 + 1)
            return hashlib.sha256(body).hexdigest() if len(body) <= 15 * 1024 * 1024 else None
    except Exception as exc:
        print(f"warning: could not fingerprint {url}: {exc}", file=sys.stderr)
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default=os.getenv("AWS_PROFILE", "sevafix-deploy"))
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "ap-south-1"))
    parser.add_argument("--skip-source-fetch", action="store_true")
    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    result = outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(result["TableName"])
    s3 = session.client("s3")
    timestamp = now()

    scheme = {
        "PK": f"SCHEME#{SCHEME_ID}", "SK": "META", "entityType": "Scheme", "schemeId": SCHEME_ID,
        "name": "PM-USP Central Sector Scheme of Scholarship for College and University Students",
        "shortName": "PM-USP CSSS", "status": "ACTIVE", "activePolicyVersionId": POLICY_VERSION,
        "officialPortalUrl": "https://scholarships.gov.in/", "updatedAt": timestamp,
        "disclaimer": "SevaFix prepares and checks applications; the official authority decides eligibility and submission status.",
    }
    catalog = {**scheme, "PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{SCHEME_ID}"}
    policy = {
        "PK": f"POLICY#{SCHEME_ID}", "SK": f"VERSION#{POLICY_VERSION}", "entityType": "PolicyVersion",
        "schemeId": SCHEME_ID, "policyVersionId": POLICY_VERSION, "status": "PUBLISHED", "publishedAt": timestamp,
        "engineVersion": "rules-engine@1.0.0", "sourceIds": [s["sourceId"] for s in SOURCES],
    }
    with table.batch_writer() as batch:
        batch.put_item(Item=scheme)
        batch.put_item(Item=catalog)
        batch.put_item(Item=policy)
        for rule in RULES:
            batch.put_item(Item={"PK": f"RULESET#{POLICY_VERSION}", "SK": f"RULE#{rule['ruleId']}", "entityType": "Rule", "policyVersionId": POLICY_VERSION, **rule})
        for source in SOURCES:
            item = {
                "PK": "SOURCES#REGISTRY", "SK": f"SOURCE#{source['sourceId']}", "entityType": "OfficialSource",
                "schemeId": SCHEME_ID, "enabled": True, "createdAt": timestamp, **source,
            }
            if not args.skip_source_fetch:
                digest = source_hash(source["url"])
                if digest:
                    item["contentSha256"] = digest
                    item["lastCheckedAt"] = timestamp
            batch.put_item(Item=item)

    key = f"published/{SCHEME_ID}/{POLICY_VERSION}/policy.md"
    s3.put_object(Bucket=result["PolicyBucketName"], Key=key, Body=POLICY_TEXT.encode("utf-8"), ContentType="text/markdown")
    metadata = {"metadataAttributes": {"schemeId": SCHEME_ID, "policyVersionId": POLICY_VERSION, "status": "PUBLISHED", "authority": "Ministry of Education / National Scholarship Portal"}}
    s3.put_object(Bucket=result["PolicyBucketName"], Key=f"{key}.metadata.json", Body=json.dumps(metadata).encode("utf-8"), ContentType="application/json")

    ingestion = None
    ingestion_error = None
    if result.get("KnowledgeBaseId") and result.get("KnowledgeBaseDataSourceId"):
        try:
            ingestion = session.client("bedrock-agent").start_ingestion_job(knowledgeBaseId=result["KnowledgeBaseId"], dataSourceId=result["KnowledgeBaseDataSourceId"])["ingestionJob"]["ingestionJobId"]
        except Exception as exc:
            ingestion_error = str(exc)
    print(json.dumps({"seeded": True, "schemeId": SCHEME_ID, "policyVersionId": POLICY_VERSION, "ruleCount": len(RULES), "policyKey": key, "ingestionJobId": ingestion, "ingestionError": ingestion_error}, indent=2))


if __name__ == "__main__":
    main()

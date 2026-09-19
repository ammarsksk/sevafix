from __future__ import annotations

import json
import logging
import re
from decimal import Decimal
from typing import Any
from urllib.parse import unquote_plus

import boto3

from common import settings
from common.store import Store
from common.util import new_id, normalize_text, stable_hash, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

textract = boto3.client("textract")
s3 = boto3.client("s3")
sfn = boto3.client("stepfunctions")

QUERIES = [
    {"Text": "What is the applicant or student name?", "Alias": "APPLICANT_NAME", "Pages": ["*"]},
    {"Text": "What is the annual family income?", "Alias": "ANNUAL_INCOME", "Pages": ["*"]},
    {"Text": "What is the date of birth?", "Alias": "DATE_OF_BIRTH", "Pages": ["*"]},
    {"Text": "What academic or financial year is shown?", "Alias": "ACADEMIC_YEAR", "Pages": ["*"]},
    {"Text": "What is the institution name?", "Alias": "INSTITUTION_NAME", "Pages": ["*"]},
    {"Text": "What is the course name?", "Alias": "COURSE_NAME", "Pages": ["*"]},
]


def _lookup_document(store: Store, document_id: str, application_id: str | None = None) -> dict[str, Any]:
    if application_id:
        item = store.get(f"APP#{application_id}", f"DOC#{document_id}", consistent=True)
    else:
        lookup = store.get(f"DOC#{document_id}", "LOOKUP", consistent=True)
        item = store.get(f"APP#{lookup['appId']}", f"DOC#{document_id}", consistent=True) if lookup else None
    if not item:
        raise LookupError("Document not found")
    return item


def _start(event: dict[str, Any], store: Store) -> dict[str, Any]:
    doc = _lookup_document(store, event["documentId"], event.get("applicationId"))
    if doc.get("state") not in {"UPLOADED", "SCAN_CLEAN", "OCR_FAILED_RETRYABLE"}:
        if doc.get("state") in {"EXTRACTED", "NEEDS_USER_CONFIRMATION"}:
            return {**event, "ocrStatus": "SUCCEEDED", "idempotent": True}
        raise ValueError(f"Document is not ready for OCR: {doc.get('state')}")
    token = stable_hash({"documentId": doc["documentId"], "etag": doc.get("etag")})[:64]
    result = textract.start_document_analysis(
        DocumentLocation={"S3Object": {"Bucket": doc["s3Bucket"], "Name": doc["s3Key"]}},
        FeatureTypes=["FORMS", "TABLES", "QUERIES"],
        QueriesConfig={"Queries": QUERIES},
        ClientRequestToken=token,
        JobTag=doc["documentId"][-64:],
    )
    now = utc_now()
    store.update(
        doc["PK"], doc["SK"],
        "SET #state=:state, textractJobId=:job, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk",
        {":state": "OCR_RUNNING", ":job": result["JobId"], ":now": now, ":gpk": "DOCSTATE#OCR_RUNNING", ":gsk": f"{now}#{doc['documentId']}"},
        names={"#state": "state"},
    )
    return {**event, "ownerSub": doc["ownerSub"], "textractJobId": result["JobId"], "ocrStatus": "IN_PROGRESS"}


def _query_answers(blocks: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    by_id = {block["Id"]: block for block in blocks if block.get("Id")}
    answers: dict[str, dict[str, Any]] = {}
    for block in blocks:
        if block.get("BlockType") != "QUERY":
            continue
        alias = block.get("Query", {}).get("Alias") or block.get("Query", {}).get("Text")
        for relationship in block.get("Relationships", []):
            if relationship.get("Type") != "ANSWER":
                continue
            for answer_id in relationship.get("Ids", []):
                answer = by_id.get(answer_id, {})
                answers[str(alias)] = {
                    "value": normalize_text(answer.get("Text")),
                    "confidence": Decimal(str(answer.get("Confidence", 0))),
                    "page": answer.get("Page"),
                    "boundingBox": answer.get("Geometry", {}).get("BoundingBox"),
                }
    return answers


def _parse_money(value: str) -> int | None:
    cleaned = re.sub(r"[^0-9.]", "", value.replace(",", ""))
    try:
        return int(Decimal(cleaned)) if cleaned else None
    except Exception:
        return None


def _normalize(blocks: list[dict[str, Any]]) -> tuple[dict[str, Any], str, Decimal]:
    answers = _query_answers(blocks)
    lines = [normalize_text(block.get("Text")) for block in blocks if block.get("BlockType") == "LINE" and block.get("Text")]
    confidence_values = [Decimal(str(block.get("Confidence", 0))) for block in blocks if block.get("BlockType") in {"WORD", "QUERY_RESULT"}]
    overall = sum(confidence_values, Decimal(0)) / len(confidence_values) if confidence_values else Decimal(0)
    facts: dict[str, Any] = {}
    mapping = {
        "APPLICANT_NAME": "primaryName",
        "DATE_OF_BIRTH": "dateOfBirth",
        "ACADEMIC_YEAR": "academicYear",
        "INSTITUTION_NAME": "institutionName",
        "COURSE_NAME": "courseName",
    }
    for alias, field in mapping.items():
        if answers.get(alias, {}).get("value"):
            facts[field] = answers[alias]
    income = answers.get("ANNUAL_INCOME")
    if income and income.get("value"):
        facts["annualIncomeINR"] = {**income, "value": _parse_money(str(income["value"]))}
    return facts, "\n".join(lines)[:100_000], overall


def _poll(event: dict[str, Any], store: Store) -> dict[str, Any]:
    doc = _lookup_document(store, event["documentId"], event.get("applicationId"))
    job_id = event.get("textractJobId") or doc.get("textractJobId")
    result = textract.get_document_analysis(JobId=job_id, MaxResults=1000)
    status = result["JobStatus"]
    if status == "IN_PROGRESS":
        return {**event, "ocrStatus": status}
    if status != "SUCCEEDED":
        now = utc_now()
        store.update(doc["PK"], doc["SK"], "SET #state=:state, ocrFailure=:failure, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk", {":state": "OCR_FAILED_FINAL", ":failure": result.get("StatusMessage", status), ":now": now, ":gpk": "DOCSTATE#OCR_FAILED_FINAL", ":gsk": f"{now}#{doc['documentId']}"}, names={"#state": "state"})
        return {**event, "ocrStatus": "FAILED", "failure": result.get("StatusMessage", status)}
    blocks = list(result.get("Blocks", []))
    token = result.get("NextToken")
    while token:
        page = textract.get_document_analysis(JobId=job_id, MaxResults=1000, NextToken=token)
        blocks.extend(page.get("Blocks", []))
        token = page.get("NextToken")
    derived_key = doc["s3Key"].rsplit("/", 1)[0] + "/textract.json"
    raw = {"DocumentMetadata": result.get("DocumentMetadata"), "Blocks": blocks, "AnalyzeDocumentModelVersion": result.get("AnalyzeDocumentModelVersion")}
    s3.put_object(Bucket=settings.CITIZEN_BUCKET, Key=derived_key, Body=json.dumps(raw, default=str).encode("utf-8"), ContentType="application/json")
    facts, text, overall = _normalize(blocks)
    decisive = [value.get("confidence", Decimal(0)) for value in facts.values() if isinstance(value, dict)]
    needs_confirmation = any(value < 98 for value in decisive)
    final_state = "UNSUPPORTED_LANGUAGE" if not text else ("NEEDS_USER_CONFIRMATION" if needs_confirmation else "EXTRACTED")
    now = utc_now()
    store.update(
        doc["PK"], doc["SK"],
        "SET #state=:state, extractedFacts=:facts, extractedText=:text, ocrConfidence=:confidence, textractOutputKey=:output, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk",
        {":state": final_state, ":facts": facts, ":text": text, ":confidence": overall, ":output": derived_key, ":now": now, ":gpk": f"DOCSTATE#{final_state}", ":gsk": f"{now}#{doc['documentId']}"},
        names={"#state": "state"},
    )
    store.append_event(doc["appId"], "DOCUMENT_EXTRACTED", "SYSTEM", {"documentId": doc["documentId"], "state": final_state, "overallConfidence": overall}, event_id=new_id("evt"))
    return {**event, "ocrStatus": "SUCCEEDED", "documentState": final_state}


def _guardduty_event(event: dict[str, Any], store: Store) -> dict[str, Any]:
    detail = event.get("detail", {})
    bucket = detail.get("s3ObjectDetails", {}).get("bucketName") or detail.get("bucketName")
    key = unquote_plus(detail.get("s3ObjectDetails", {}).get("objectKey") or detail.get("objectKey") or "")
    status = detail.get("scanResultDetails", {}).get("scanResultStatus") or detail.get("scanResultStatus")
    match = re.search(r"/documents/(doc_[a-f0-9]+)/", key)
    if not match:
        return {"ignored": True}
    document_id = match.group(1)
    doc = _lookup_document(store, document_id)
    now = utc_now()
    if status == "NO_THREATS_FOUND":
        store.update(doc["PK"], doc["SK"], "SET #state=:state, malwareScanStatus=:scan, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk", {":state": "SCAN_CLEAN", ":scan": status, ":now": now, ":gpk": "DOCSTATE#SCAN_CLEAN", ":gsk": f"{now}#{document_id}"}, names={"#state": "state"})
        execution = sfn.start_execution(stateMachineArn=settings.DOCUMENT_STATE_MACHINE_ARN, name=f"doc-{document_id[-24:]}", input=json.dumps({"documentId": document_id, "applicationId": doc["appId"]}))
        return {"started": execution["executionArn"]}
    store.update(doc["PK"], doc["SK"], "SET #state=:state, malwareScanStatus=:scan, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk", {":state": "QUARANTINED", ":scan": status or "UNKNOWN", ":now": now, ":gpk": "DOCSTATE#QUARANTINED", ":gsk": f"{now}#{document_id}"}, names={"#state": "state"})
    return {"quarantined": document_id}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    LOGGER.info(json.dumps({"message": "pipeline action", "action": event.get("action"), "documentId": event.get("documentId")}))
    store = Store()
    if event.get("source") == "aws.guardduty":
        return _guardduty_event(event, store)
    action = event.get("action")
    if action == "start":
        return _start(event, store)
    if action == "poll":
        return _poll(event, store)
    raise ValueError("Unsupported pipeline action")

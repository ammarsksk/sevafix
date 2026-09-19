from __future__ import annotations

import json
import logging
import re
import base64
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

from common import settings
from common.store import Store
from common.util import (
    correlation_id,
    error_response,
    groups,
    hmac_display,
    item_size_safe,
    new_id,
    parse_body,
    redact_identifier,
    require_group,
    response,
    stable_hash,
    subject,
    utc_now,
)


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
s3 = boto3.client("s3", region_name=AWS_REGION, config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
sfn = boto3.client("stepfunctions")
lambda_client = boto3.client("lambda")
bedrock_agent = boto3.client("bedrock-agent")

RULE_OPERATORS = {"PRESENT", "EQ", "NEQ", "LT", "LTE", "GT", "GTE", "IN", "NOT_IN", "DATE_BETWEEN", "NAME_SIMILAR"}


def _route(event: dict[str, Any]) -> tuple[str, str]:
    request_context = event.get("requestContext", {})
    method = request_context.get("http", {}).get("method", "GET").upper()
    path = event.get("rawPath") or event.get("path") or "/"
    stage = request_context.get("stage")
    if stage and path == f"/{stage}":
        path = "/"
    elif stage and path.startswith(f"/{stage}/"):
        path = path[len(stage) + 1:]
    return method, path.rstrip("/") or "/"


def _path_match(path: str, pattern: str) -> dict[str, str] | None:
    names = re.findall(r"\{([^}]+)\}", pattern)
    regex = "^" + re.sub(r"\{[^}]+\}", r"([^/]+)", pattern) + "$"
    match = re.match(regex, path)
    return dict(zip(names, match.groups(), strict=True)) if match else None


def _require_fields(body: dict[str, Any], names: list[str]) -> None:
    missing = [name for name in names if body.get(name) in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")


def _application_view(store: Store, app_id: str, owner_sub: str) -> dict[str, Any]:
    meta = store.assert_owner(app_id, owner_sub)
    items = store.query(f"APP#{app_id}")
    documents = [item for item in items if item["SK"].startswith("DOC#") and item.get("state") != "DELETED"]
    versions = [item for item in items if item["SK"].startswith("VER#")]
    events = [item for item in items if item["SK"].startswith("EVENT#")]
    runs = [item for item in items if item["SK"].startswith("RUN#")]
    checks = [item for item in items if item["SK"].startswith("CHECK#")]
    diagnoses = [item for item in items if item["SK"].startswith("DIAG#")]
    repairs = [item for item in items if item["SK"].startswith("REPAIR#")]
    return {
        "application": meta,
        "documents": documents,
        "versions": versions,
        "timeline": events,
        "validationRuns": runs,
        "checks": checks,
        "diagnoses": diagnoses,
        "repairs": repairs,
    }


def _create_application(store: Store, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["schemeId"])
    scheme = store.get(f"SCHEME#{body['schemeId']}", "META", consistent=True)
    if not scheme or scheme.get("status") != "ACTIVE":
        raise ValueError("Unsupported or inactive scheme")
    journey_type = str(body.get("journeyType") or "NEW_APPLICATION")
    if journey_type not in {"NEW_APPLICATION", "GRIEVANCE"}:
        raise ValueError("journeyType must be NEW_APPLICATION or GRIEVANCE")
    draft_fields = item_size_safe(body.get("draftFields", {}), 100_000)
    if not isinstance(draft_fields, dict):
        raise ValueError("draftFields must be an object")
    now = utc_now()
    app_id = new_id("app")
    meta = {
        "PK": f"APP#{app_id}",
        "SK": "META",
        "entityType": "Application",
        "appId": app_id,
        "ownerSub": owner_sub,
        "schemeId": body["schemeId"],
        "journeyType": journey_type,
        "policyVersionId": scheme.get("activePolicyVersionId"),
        "lifecycleStatus": "DRAFT",
        "draftFields": draft_fields,
        "revision": 0,
        "currentVersion": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    summary = {
        "PK": f"USER#{owner_sub}",
        "SK": f"APP#{now}#{app_id}",
        "entityType": "ApplicationSummary",
        "appId": app_id,
        "schemeId": body["schemeId"],
        "journeyType": journey_type,
        "lifecycleStatus": "DRAFT",
        "createdAt": now,
        "updatedAt": now,
    }
    event_id = new_id("evt")
    event = {
        "PK": f"APP#{app_id}",
        "SK": f"EVENT#{now}#{event_id}",
        "entityType": "TimelineEvent",
        "eventId": event_id,
        "eventType": "APPLICATION_CREATED",
        "actor": owner_sub,
        "payload": {"schemeId": body["schemeId"], "journeyType": journey_type},
        "occurredAt": now,
    }
    store.transact([
        {"Put": {"Item": meta, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Put": {"Item": summary, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Put": {"Item": event, "ConditionExpression": "attribute_not_exists(PK)"}},
    ])
    return meta


def _open_grievance(store: Store, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["schemeId", "sourceApplication"])
    source_application = str(body["sourceApplication"]).upper()
    if source_application not in {"SEVAFIX", "EXTERNAL"}:
        raise ValueError("sourceApplication must be SEVAFIX or EXTERNAL")
    rejection_reason = str(body.get("rejectionReason") or "").strip()
    if len(rejection_reason) > 10_000:
        raise ValueError("rejectionReason must not exceed 10000 characters")

    if source_application == "SEVAFIX":
        _require_fields(body, ["existingApplicationId"])
        app_id = str(body["existingApplicationId"])
        meta = store.assert_owner(app_id, owner_sub)
        if meta.get("schemeId") != body["schemeId"]:
            raise ValueError("The selected application does not belong to this scheme")
        if not meta.get("currentVersion"):
            _freeze_version(store, app_id, owner_sub)
        now = utc_now()
        values = {":now": now, ":source": source_application, ":provided": bool(rejection_reason), ":owner": owner_sub}
        expression = "SET grievanceOpenedAt=:now, sourceApplication=:source, grievanceReasonProvided=:provided, updatedAt=:now"
        if rejection_reason:
            expression += ", initialGrievanceReason=:reason"
            values[":reason"] = rejection_reason
        updated = store.update(
            f"APP#{app_id}",
            "META",
            expression,
            values,
            condition="ownerSub=:owner",
        )
        store.append_event(app_id, "GRIEVANCE_OPENED", owner_sub, {"sourceApplication": source_application}, event_id=new_id("evt"), occurred_at=now)
        return updated

    _require_fields(body, ["officialApplicationId"])
    meta = _create_application(
        store,
        owner_sub,
        {"schemeId": body["schemeId"], "journeyType": "GRIEVANCE"},
    )
    _freeze_version(store, meta["appId"], owner_sub)
    now = utc_now()
    display = redact_identifier(str(body["officialApplicationId"]), 4)
    values: dict[str, Any] = {
        ":status": "SUBMITTED",
        ":source": source_application,
        ":provided": bool(rejection_reason),
        ":hash": stable_hash(str(body["officialApplicationId"])),
        ":display": display,
        ":now": now,
        ":owner": owner_sub,
    }
    expression = "SET lifecycleStatus=:status, sourceApplication=:source, grievanceOpenedAt=:now, grievanceReasonProvided=:provided, officialApplicationIdHash=:hash, officialApplicationIdDisplay=:display, updatedAt=:now"
    if rejection_reason:
        expression += ", initialGrievanceReason=:reason"
        values[":reason"] = rejection_reason
    if body.get("submittedAt"):
        expression += ", submittedAt=:submitted"
        values[":submitted"] = str(body["submittedAt"])
    updated = store.update(
        f"APP#{meta['appId']}",
        "META",
        expression,
        values,
        condition="ownerSub=:owner",
    )
    store.update(
        f"USER#{owner_sub}",
        f"APP#{meta['createdAt']}#{meta['appId']}",
        "SET lifecycleStatus=:status, updatedAt=:now",
        {":status": "SUBMITTED", ":now": now},
    )
    store.append_event(meta["appId"], "EXTERNAL_GRIEVANCE_IMPORTED", owner_sub, {"officialApplicationIdDisplay": display}, event_id=new_id("evt"), occurred_at=now)
    return updated


def _patch_draft(store: Store, app_id: str, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    meta = store.assert_owner(app_id, owner_sub)
    if meta.get("lifecycleStatus") not in {"DRAFT", "REPAIR_DRAFT", "ACTION_REQUIRED"}:
        raise ValueError("This application version is not editable")
    fields = item_size_safe(body.get("fields", {}), 100_000)
    if not isinstance(fields, dict):
        raise ValueError("fields must be an object")
    expected_revision = int(body.get("expectedRevision", meta.get("revision", 0)))
    merged = dict(meta.get("draftFields", {}))
    merged.update(fields)
    now = utc_now()
    return store.update(
        f"APP#{app_id}",
        "META",
        "SET draftFields=:fields, updatedAt=:now, revision=revision+:one",
        {":fields": merged, ":now": now, ":one": 1, ":expected": expected_revision, ":owner": owner_sub},
        condition="ownerSub=:owner AND revision=:expected",
    )


def _freeze_version(store: Store, app_id: str, owner_sub: str) -> dict[str, Any]:
    meta = store.assert_owner(app_id, owner_sub)
    number = int(meta.get("currentVersion", 0)) + 1
    version_id = f"v{number}"
    now = utc_now()
    snapshot = {
        "PK": f"APP#{app_id}",
        "SK": f"VER#{number:06d}",
        "entityType": "ApplicationVersion",
        "appId": app_id,
        "versionId": version_id,
        "versionNumber": number,
        "parentVersionId": meta.get("currentVersionId"),
        "policyVersionId": meta.get("policyVersionId"),
        "fields": meta.get("draftFields", {}),
        "status": "FROZEN",
        "createdAt": now,
        "createdBy": owner_sub,
    }
    store.transact([
        {"Put": {"Item": snapshot, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Update": {
            "Key": {"PK": f"APP#{app_id}", "SK": "META"},
            "UpdateExpression": "SET currentVersion=:n, currentVersionId=:vid, updatedAt=:now",
            "ConditionExpression": "ownerSub=:owner AND currentVersion=:previous",
            "ExpressionAttributeValues": {":n": number, ":vid": version_id, ":now": now, ":owner": owner_sub, ":previous": number - 1},
        }},
    ])
    store.append_event(app_id, "APPLICATION_VERSION_FROZEN", owner_sub, {"versionId": version_id}, event_id=new_id("evt"), occurred_at=now)
    return snapshot


def _create_upload(store: Store, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["applicationId", "documentType", "contentType", "size", "sha256"])
    app_id = str(body["applicationId"])
    store.assert_owner(app_id, owner_sub)
    content_type = str(body["contentType"]).lower()
    if content_type not in settings.ALLOWED_MIME_TYPES:
        raise ValueError("Unsupported file type")
    size = int(body["size"])
    if size <= 0 or size > settings.MAX_UPLOAD_BYTES:
        raise ValueError(f"File size must be between 1 and {settings.MAX_UPLOAD_BYTES} bytes")
    checksum = str(body["sha256"]).lower()
    if not re.fullmatch(r"[a-f0-9]{64}", checksum):
        raise ValueError("sha256 must be a 64-character hexadecimal digest")
    doc_id = new_id("doc")
    now = utc_now()
    owner_prefix = hmac_display(owner_sub)
    extension = settings.ALLOWED_MIME_TYPES[content_type]
    key = f"users/{owner_prefix}/applications/{app_id}/documents/{doc_id}/original{extension}"
    item = {
        "PK": f"APP#{app_id}",
        "SK": f"DOC#{doc_id}",
        "entityType": "Document",
        "documentId": doc_id,
        "appId": app_id,
        "ownerSub": owner_sub,
        "documentType": str(body["documentType"]),
        "contentType": content_type,
        "declaredSize": size,
        "sha256": checksum,
        "s3Bucket": settings.CITIZEN_BUCKET,
        "s3Key": key,
        "state": "PENDING_UPLOAD",
        "createdAt": now,
        "updatedAt": now,
        "GSI3PK": "DOCSTATE#PENDING_UPLOAD",
        "GSI3SK": f"{now}#{doc_id}",
    }
    lookup = {
        "PK": f"DOC#{doc_id}", "SK": "LOOKUP", "entityType": "DocumentLookup",
        "documentId": doc_id, "appId": app_id, "ownerSub": owner_sub,
        "createdAt": now,
    }
    store.transact([
        {"Put": {"Item": item, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Put": {"Item": lookup, "ConditionExpression": "attribute_not_exists(PK)"}},
    ])
    checksum_b64 = base64.b64encode(bytes.fromhex(checksum)).decode("ascii")
    url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.CITIZEN_BUCKET,
            "Key": key,
            "ContentType": content_type,
            "ChecksumSHA256": checksum_b64,
            "Metadata": {"document-id": doc_id, "application-id": app_id},
        },
        ExpiresIn=settings.UPLOAD_URL_TTL_SECONDS,
    )
    return {
        "documentId": doc_id,
        "uploadUrl": url,
        "expiresIn": settings.UPLOAD_URL_TTL_SECONDS,
        "requiredHeaders": {
            "Content-Type": content_type,
            "x-amz-meta-document-id": doc_id,
            "x-amz-meta-application-id": app_id,
            "x-amz-checksum-sha256": checksum_b64,
        },
    }


def _complete_upload(store: Store, doc_id: str, owner_sub: str) -> dict[str, Any]:
    lookup = store.get(f"DOC#{doc_id}", "LOOKUP", consistent=True)
    document = store.get(f"APP#{lookup['appId']}", f"DOC#{doc_id}", consistent=True) if lookup else None
    if document and document.get("ownerSub") != owner_sub:
        document = None
    if not document:
        raise LookupError("Pending document not found")
    head = s3.head_object(Bucket=document["s3Bucket"], Key=document["s3Key"], ChecksumMode="ENABLED")
    if int(head["ContentLength"]) != int(document["declaredSize"]):
        raise ValueError("Uploaded size does not match the declared size")
    if head.get("ContentType", "").lower() != document["contentType"]:
        raise ValueError("Uploaded content type does not match")
    metadata = head.get("Metadata", {})
    if metadata.get("document-id") != doc_id or metadata.get("application-id") != document["appId"]:
        raise ValueError("Upload metadata does not match the upload session")
    expected_checksum = base64.b64encode(bytes.fromhex(document["sha256"])).decode("ascii")
    if head.get("ChecksumSHA256") != expected_checksum:
        raise ValueError("Uploaded checksum does not match the declared SHA-256")
    now = utc_now()
    next_state = "SCANNING" if settings.MALWARE_PROTECTION_ENABLED else "UPLOADED"
    updated = store.update(
        document["PK"], document["SK"],
        "SET #state=:state, updatedAt=:now, s3VersionId=:version, etag=:etag, GSI3PK=:gpk, GSI3SK=:gsk",
        {":state": next_state, ":pending": "PENDING_UPLOAD", ":now": now, ":version": head.get("VersionId", "null"), ":etag": head.get("ETag", "").strip('"'), ":gpk": f"DOCSTATE#{next_state}", ":gsk": f"{now}#{doc_id}"},
        names={"#state": "state"},
        condition="#state=:pending",
    )
    if not settings.MALWARE_PROTECTION_ENABLED:
        execution = sfn.start_execution(
            stateMachineArn=settings.DOCUMENT_STATE_MACHINE_ARN,
            name=f"doc-{doc_id[-24:]}",
            input=json.dumps({"documentId": doc_id, "applicationId": document["appId"]}),
        )
        updated["workflowExecutionArn"] = execution["executionArn"]
    return updated


def _find_document(store: Store, app_id: str, doc_id: str, owner_sub: str) -> dict[str, Any]:
    store.assert_owner(app_id, owner_sub)
    item = store.get(f"APP#{app_id}", f"DOC#{doc_id}", consistent=True)
    if not item or item.get("ownerSub") != owner_sub:
        raise LookupError("Document not found")
    return item


def _find_document_by_id(store: Store, doc_id: str, owner_sub: str) -> dict[str, Any]:
    lookup = store.get(f"DOC#{doc_id}", "LOOKUP", consistent=True)
    if not lookup or lookup.get("ownerSub") != owner_sub:
        raise LookupError("Document not found")
    return _find_document(store, lookup["appId"], doc_id, owner_sub)


def _document_view_url(store: Store, document: dict[str, Any], owner_sub: str) -> dict[str, Any]:
    if document.get("state") in {"QUARANTINED", "DELETED"}:
        raise PermissionError("This document cannot be viewed")
    url = s3.generate_presigned_url("get_object", Params={"Bucket": document["s3Bucket"], "Key": document["s3Key"], "ResponseContentDisposition": "inline"}, ExpiresIn=settings.VIEW_URL_TTL_SECONDS)
    store.append_event(document["appId"], "DOCUMENT_VIEW_URL_ISSUED", owner_sub, {"documentId": document["documentId"]}, event_id=new_id("evt"))
    return {"viewUrl": url, "expiresIn": settings.VIEW_URL_TTL_SECONDS}


def _delete_document(store: Store, document: dict[str, Any]) -> dict[str, Any]:
    s3.delete_object(Bucket=document["s3Bucket"], Key=document["s3Key"])
    now = utc_now()
    return store.update(document["PK"], document["SK"], "SET #state=:deleted, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk", {":deleted": "DELETED", ":now": now, ":gpk": "DOCSTATE#DELETED", ":gsk": f"{now}#{document['documentId']}"}, names={"#state": "state"})


def _start_validation(store: Store, app_id: str, owner_sub: str) -> dict[str, Any]:
    store.assert_owner(app_id, owner_sub)
    job_id = new_id("job")
    now = utc_now()
    job = {
        "PK": f"USER#{owner_sub}", "SK": f"JOB#{job_id}", "entityType": "Job",
        "jobId": job_id, "jobType": "VALIDATION", "applicationId": app_id,
        "status": "QUEUED", "createdAt": now, "updatedAt": now,
    }
    store.put(job, condition="attribute_not_exists(PK)")
    lambda_client.invoke(
        FunctionName=settings.VALIDATION_FUNCTION_ARN,
        InvocationType="Event",
        Payload=json.dumps({"applicationId": app_id, "ownerSub": owner_sub, "jobId": job_id}).encode(),
    )
    return job


def _record_submission(store: Store, app_id: str, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["officialApplicationId", "submittedAt"])
    meta = store.assert_owner(app_id, owner_sub)
    if not meta.get("currentVersionId"):
        raise ValueError("Freeze an application version before recording submission")
    now = utc_now()
    display = redact_identifier(str(body["officialApplicationId"]), 4)
    updated = store.update(
        f"APP#{app_id}", "META",
        "SET lifecycleStatus=:status, officialApplicationIdHash=:hash, officialApplicationIdDisplay=:display, submittedAt=:submitted, updatedAt=:now",
        {":status": "SUBMITTED", ":hash": stable_hash(str(body["officialApplicationId"])), ":display": display, ":submitted": body["submittedAt"], ":now": now, ":owner": owner_sub},
        condition="ownerSub=:owner",
    )
    store.append_event(app_id, "OFFICIAL_SUBMISSION_RECORDED", owner_sub, {"officialApplicationIdDisplay": display, "submittedAt": body["submittedAt"], "versionId": meta["currentVersionId"]}, event_id=new_id("evt"))
    return updated


def _repair(store: Store, app_id: str, owner_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    meta = store.assert_owner(app_id, owner_sub)
    if not meta.get("currentVersion"):
        raise ValueError("No frozen version is available to repair")
    source = store.get(f"APP#{app_id}", f"VER#{int(meta['currentVersion']):06d}", consistent=True)
    if not source:
        raise LookupError("Source version not found")
    repair_id = new_id("repair")
    now = utc_now()
    item = {
        "PK": f"APP#{app_id}", "SK": f"REPAIR#{repair_id}", "entityType": "RepairCase",
        "repairId": repair_id, "fromVersionId": source["versionId"], "diagnosisId": body.get("diagnosisId"),
        "status": "OPEN", "createdAt": now, "createdBy": owner_sub,
    }
    store.transact([
        {"Put": {"Item": item, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Update": {
            "Key": {"PK": f"APP#{app_id}", "SK": "META"},
            "UpdateExpression": "SET lifecycleStatus=:status, draftFields=:fields, activeRepairId=:repair, updatedAt=:now, revision=revision+:one",
            "ConditionExpression": "ownerSub=:owner",
            "ExpressionAttributeValues": {":status": "REPAIR_DRAFT", ":fields": source.get("fields", {}), ":repair": repair_id, ":now": now, ":one": 1, ":owner": owner_sub},
        }},
    ])
    store.append_event(app_id, "REPAIR_VERSION_STARTED", owner_sub, {"repairId": repair_id, "fromVersionId": source["versionId"]}, event_id=new_id("evt"))
    return item


def _publish_policy(store: Store, version_id: str, reviewer_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["schemeId", "rules", "policyText", "auditReason", "confirmation"])
    if body["confirmation"] != "PUBLISH":
        raise ValueError("confirmation must be PUBLISH")
    scheme_id = str(body["schemeId"])
    rules = body["rules"]
    if not isinstance(rules, list) or not 1 <= len(rules) <= 20:
        raise ValueError("rules must contain between 1 and 20 entries")
    policy_text = str(body["policyText"])
    if not policy_text.strip() or len(policy_text) > 200_000:
        raise ValueError("policyText must contain 1 to 200000 characters")
    scheme = store.get(f"SCHEME#{scheme_id}", "META", consistent=True)
    if not scheme:
        raise LookupError("Scheme not found")
    if store.get(f"POLICY#{scheme_id}", f"VERSION#{version_id}", consistent=True):
        raise ValueError("Policy version already exists and is immutable")
    rule_ids: set[str] = set()
    normalized_rules: list[dict[str, Any]] = []
    for raw in rules:
        if not isinstance(raw, dict) or not raw.get("ruleId") or not isinstance(raw.get("assert"), dict):
            raise ValueError("Each rule requires ruleId and assert")
        rule_id = str(raw["ruleId"])
        assertion = raw["assert"]
        if rule_id in rule_ids or assertion.get("op") not in RULE_OPERATORS or not assertion.get("field"):
            raise ValueError(f"Invalid or duplicate rule: {rule_id}")
        rule_ids.add(rule_id)
        normalized_rules.append(item_size_safe(raw, 30_000))
    source_ids = [str(value) for value in body.get("sourceIds", [])][:10]
    now = utc_now()
    key = f"published/{scheme_id}/{version_id}/policy.md"
    metadata = {"metadataAttributes": {"schemeId": scheme_id, "policyVersionId": version_id, "reviewState": "PUBLISHED", "authority": str(body.get("authority", "Official source"))[:128]}}
    s3.put_object(Bucket=settings.POLICY_BUCKET, Key=key, Body=policy_text.encode("utf-8"), ContentType="text/markdown")
    s3.put_object(Bucket=settings.POLICY_BUCKET, Key=f"{key}.metadata.json", Body=json.dumps(metadata).encode("utf-8"), ContentType="application/json")
    policy = {
        "PK": f"POLICY#{scheme_id}", "SK": f"VERSION#{version_id}", "entityType": "PolicyVersion",
        "schemeId": scheme_id, "policyVersionId": version_id, "status": "PUBLISHED",
        "effectiveFrom": body.get("effectiveFrom", now[:10]), "effectiveDateConfidence": body.get("effectiveDateConfidence", "CONFIRMED"),
        "sourceIds": source_ids, "policyS3Key": key, "publishedAt": now, "publishedBy": reviewer_sub,
        "auditReason": str(body["auditReason"])[:2000], "engineVersion": "rules-engine@1.0.0",
    }
    audit_id = new_id("audit")
    actions: list[dict[str, Any]] = [
        {"Put": {"Item": policy, "ConditionExpression": "attribute_not_exists(PK)"}},
        {"Put": {"Item": {"PK": f"POLICY#{scheme_id}", "SK": f"AUDIT#{now}#{audit_id}", "entityType": "PolicyAudit", "action": "PUBLISH", "policyVersionId": version_id, "actor": reviewer_sub, "reason": str(body["auditReason"])[:2000], "createdAt": now}}},
    ]
    for rule in normalized_rules:
        actions.append({"Put": {"Item": {"PK": f"RULESET#{version_id}", "SK": f"RULE#{rule['ruleId']}", "entityType": "Rule", "policyVersionId": version_id, **rule}, "ConditionExpression": "attribute_not_exists(PK)"}})
    previous = scheme.get("activePolicyVersionId")
    if previous:
        actions.append({"Update": {"Key": {"PK": f"POLICY#{scheme_id}", "SK": f"VERSION#{previous}"}, "UpdateExpression": "SET effectiveTo=:end", "ExpressionAttributeValues": {":end": now[:10]}}})
    actions.extend([
        {"Update": {"Key": {"PK": f"SCHEME#{scheme_id}", "SK": "META"}, "UpdateExpression": "SET activePolicyVersionId=:version, updatedAt=:now", "ExpressionAttributeValues": {":version": version_id, ":now": now}}},
        {"Update": {"Key": {"PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme_id}"}, "UpdateExpression": "SET activePolicyVersionId=:version, updatedAt=:now", "ExpressionAttributeValues": {":version": version_id, ":now": now}}},
    ])
    store.transact(actions)
    ingestion_job_id = None
    if settings.BEDROCK_KNOWLEDGE_BASE_ID and settings.BEDROCK_DATA_SOURCE_ID:
        try:
            ingestion_job_id = bedrock_agent.start_ingestion_job(knowledgeBaseId=settings.BEDROCK_KNOWLEDGE_BASE_ID, dataSourceId=settings.BEDROCK_DATA_SOURCE_ID)["ingestionJob"]["ingestionJobId"]
        except Exception:
            LOGGER.exception("Policy published but Bedrock ingestion could not start")
    return {"policy": policy, "ruleCount": len(normalized_rules), "ingestionJobId": ingestion_job_id}


def _rollback_policy_pointer(store: Store, version_id: str, reviewer_sub: str, body: dict[str, Any]) -> dict[str, Any]:
    _require_fields(body, ["schemeId", "auditReason", "confirmation"])
    if body["confirmation"] != "ROLLBACK":
        raise ValueError("confirmation must be ROLLBACK")
    scheme_id = str(body["schemeId"])
    version = store.get(f"POLICY#{scheme_id}", f"VERSION#{version_id}", consistent=True)
    if not version or version.get("status") != "PUBLISHED":
        raise LookupError("Published policy version not found")
    now = utc_now()
    audit_id = new_id("audit")
    store.transact([
        {"Update": {"Key": {"PK": f"SCHEME#{scheme_id}", "SK": "META"}, "UpdateExpression": "SET activePolicyVersionId=:version, updatedAt=:now", "ExpressionAttributeValues": {":version": version_id, ":now": now}}},
        {"Update": {"Key": {"PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme_id}"}, "UpdateExpression": "SET activePolicyVersionId=:version, updatedAt=:now", "ExpressionAttributeValues": {":version": version_id, ":now": now}}},
        {"Put": {"Item": {"PK": f"POLICY#{scheme_id}", "SK": f"AUDIT#{now}#{audit_id}", "entityType": "PolicyAudit", "action": "ROLLBACK_POINTER", "policyVersionId": version_id, "actor": reviewer_sub, "reason": str(body["auditReason"])[:2000], "createdAt": now}}},
    ])
    return {"schemeId": scheme_id, "activePolicyVersionId": version_id, "updatedAt": now}


def _handle(method: str, path: str, event: dict[str, Any], store: Store) -> dict[str, Any]:
    if method == "GET" and path == "/health":
        return response(200, {"status": "ok", "service": "sevafix-backend", "environment": settings.ENVIRONMENT})

    owner_sub = subject(event)
    body = parse_body(event) if method in {"POST", "PATCH", "PUT"} else {}

    if method == "GET" and path == "/me":
        profile = store.get(f"USER#{owner_sub}", "PROFILE") or {"sub": owner_sub, "profileStatus": "EMPTY"}
        return response(200, profile)
    if method == "PATCH" and path == "/me":
        allowed = {
            k: body[k]
            for k in (
                "displayName",
                "governmentName",
                "locale",
                "notificationEmail",
                "notificationOptIn",
            )
            if k in body
        }
        now = utc_now()
        item = {"PK": f"USER#{owner_sub}", "SK": "PROFILE", "entityType": "UserProfile", "sub": owner_sub, "updatedAt": now, **allowed}
        existing = store.get(item["PK"], item["SK"])
        if existing:
            existing.update(item)
            item = existing
        else:
            item["createdAt"] = now
        store.put(item)
        return response(200, item)
    if method == "GET" and path == "/schemes":
        return response(200, {"items": store.query("CATALOG#SCHEMES", begins_with="SCHEME#")})
    params = _path_match(path, "/schemes/{schemeId}")
    if method == "GET" and params:
        scheme = store.get(f"SCHEME#{params['schemeId']}", "META")
        if not scheme:
            raise LookupError("Scheme not found")
        return response(200, scheme)

    if method == "POST" and path == "/applications":
        return response(201, _create_application(store, owner_sub, body))
    if method == "POST" and path == "/grievances":
        return response(201, _open_grievance(store, owner_sub, body))
    if method == "GET" and path == "/applications":
        items = store.query(f"USER#{owner_sub}", begins_with="APP#", forward=False)
        return response(200, {"items": items})
    params = _path_match(path, "/applications/{appId}")
    if method == "GET" and params:
        return response(200, _application_view(store, params["appId"], owner_sub))
    params = _path_match(path, "/applications/{appId}/draft")
    if method == "PATCH" and params:
        return response(200, _patch_draft(store, params["appId"], owner_sub, body))
    params = _path_match(path, "/applications/{appId}/versions")
    if method == "POST" and params:
        return response(201, _freeze_version(store, params["appId"], owner_sub))
    params = _path_match(path, "/applications/{appId}/validate")
    if method == "POST" and params:
        return response(202, _start_validation(store, params["appId"], owner_sub))

    if method == "POST" and path == "/documents/uploads":
        return response(201, _create_upload(store, owner_sub, body))
    params = _path_match(path, "/documents/{documentId}/complete")
    if method == "POST" and params:
        return response(202, _complete_upload(store, params["documentId"], owner_sub))
    params = _path_match(path, "/documents/{documentId}/view-url")
    if method == "POST" and params:
        return response(200, _document_view_url(store, _find_document_by_id(store, params["documentId"], owner_sub), owner_sub))
    params = _path_match(path, "/documents/{documentId}")
    if method == "DELETE" and params:
        return response(200, _delete_document(store, _find_document_by_id(store, params["documentId"], owner_sub)))
    params = _path_match(path, "/applications/{appId}/documents/{documentId}/view-url")
    if method == "POST" and params:
        document = _find_document(store, params["appId"], params["documentId"], owner_sub)
        return response(200, _document_view_url(store, document, owner_sub))
    params = _path_match(path, "/applications/{appId}/documents/{documentId}/facts")
    if method == "PATCH" and params:
        document = _find_document(store, params["appId"], params["documentId"], owner_sub)
        if document.get("state") not in {"EXTRACTED", "NEEDS_USER_CONFIRMATION", "UNSUPPORTED_LANGUAGE", "CONFIRMED"}:
            raise ValueError("Document facts cannot be confirmed in its current state")
        facts = item_size_safe(body.get("facts", {}), 100_000)
        if not isinstance(facts, dict) or not facts:
            raise ValueError("facts must be a non-empty object")
        now = utc_now()
        updated = store.update(document["PK"], document["SK"], "SET confirmedFacts=:facts, #state=:state, confirmedAt=:now, confirmedBy=:actor, updatedAt=:now, GSI3PK=:gpk, GSI3SK=:gsk", {":facts": facts, ":state": "CONFIRMED", ":now": now, ":actor": owner_sub, ":gpk": "DOCSTATE#CONFIRMED", ":gsk": f"{now}#{document['documentId']}"}, names={"#state": "state"})
        store.append_event(document["appId"], "DOCUMENT_FACTS_CONFIRMED", owner_sub, {"documentId": document["documentId"]}, event_id=new_id("evt"), occurred_at=now)
        return response(200, updated)
    params = _path_match(path, "/applications/{appId}/documents/{documentId}")
    if method == "DELETE" and params:
        document = _find_document(store, params["appId"], params["documentId"], owner_sub)
        return response(200, _delete_document(store, document))

    params = _path_match(path, "/applications/{appId}/official-submission")
    if method == "POST" and params:
        return response(200, _record_submission(store, params["appId"], owner_sub, body))
    params = _path_match(path, "/applications/{appId}/timeline-events")
    if method == "POST" and params:
        store.assert_owner(params["appId"], owner_sub)
        _require_fields(body, ["eventType"])
        item = store.append_event(params["appId"], str(body["eventType"]), owner_sub, body.get("payload", {}), event_id=new_id("evt"), occurred_at=body.get("occurredAt"))
        return response(201, item)
    params = _path_match(path, "/applications/{appId}/diagnoses")
    if method == "POST" and params:
        store.assert_owner(params["appId"], owner_sub)
        job_id = new_id("job")
        diagnosis_id = new_id("diag")
        job = {"PK": f"USER#{owner_sub}", "SK": f"JOB#{job_id}", "entityType": "Job", "jobId": job_id, "jobType": "DIAGNOSIS", "applicationId": params["appId"], "diagnosisId": diagnosis_id, "status": "QUEUED", "createdAt": utc_now(), "updatedAt": utc_now()}
        store.put(job, condition="attribute_not_exists(PK)")
        lambda_client.invoke(FunctionName=settings.DIAGNOSIS_FUNCTION_ARN, InvocationType="Event", Payload=json.dumps({"applicationId": params["appId"], "ownerSub": owner_sub, "jobId": job_id, "diagnosisId": diagnosis_id, "rejectionDocumentId": body.get("rejectionDocumentId"), "reasonText": body.get("reasonText")}).encode())
        return response(202, job)
    params = _path_match(path, "/applications/{appId}/repairs")
    if method == "POST" and params:
        return response(201, _repair(store, params["appId"], owner_sub, body))
    params = _path_match(path, "/jobs/{jobId}")
    if method == "GET" and params:
        job = store.get(f"USER#{owner_sub}", f"JOB#{params['jobId']}")
        if not job:
            raise LookupError("Job not found")
        return response(200, job)
    if method == "POST" and path == "/me/deletion":
        job_id = new_id("job")
        job = {"PK": f"USER#{owner_sub}", "SK": f"JOB#{job_id}", "entityType": "Job", "jobId": job_id, "jobType": "USER_DELETION", "status": "QUEUED", "createdAt": utc_now(), "updatedAt": utc_now()}
        store.put(job, condition="attribute_not_exists(PK)")
        lambda_client.invoke(FunctionName=settings.DELETION_FUNCTION_ARN, InvocationType="Event", Payload=json.dumps({"ownerSub": owner_sub, "jobId": job_id}).encode())
        return response(202, job)

    if path.startswith("/review/"):
        require_group(event, {"policy-reviewer", "admin"})
        if method == "GET" and path == "/review/source-changes":
            items = store.query_index("GSI2", "GSI2PK", "SOURCESTATE#CHANGED", limit=100)
            return response(200, {"items": items})
        params = _path_match(path, "/review/source-changes/{changeId}")
        if method == "GET" and params:
            item = store.get(f"SOURCECHANGE#{params['changeId']}", "META", consistent=True)
            if not item:
                raise LookupError("Source change not found")
            return response(200, item)
        params = _path_match(path, "/review/source-changes/{changeId}/approve")
        if method == "POST" and params:
            item = store.get(f"SOURCECHANGE#{params['changeId']}", "META", consistent=True)
            if not item:
                raise LookupError("Source change not found")
            now = utc_now()
            updated = store.update(item["PK"], item["SK"], "SET reviewState=:state, reviewedAt=:now, reviewedBy=:actor, GSI2PK=:gpk, GSI2SK=:gsk", {":state": "APPROVED", ":now": now, ":actor": owner_sub, ":gpk": "SOURCESTATE#APPROVED", ":gsk": f"{now}#{params['changeId']}"})
            store.update("SOURCES#REGISTRY", f"SOURCE#{item['sourceId']}", "SET contentSha256=:digest, approvedSnapshotKey=:snapshot, approvedAt=:now, approvedBy=:actor REMOVE pendingChangeId", {":digest": item["contentSha256"], ":snapshot": item["snapshotKey"], ":now": now, ":actor": owner_sub})
            return response(200, updated)
        params = _path_match(path, "/review/source-changes/{changeId}/reject")
        if method == "POST" and params:
            _require_fields(body, ["reason"])
            item = store.get(f"SOURCECHANGE#{params['changeId']}", "META", consistent=True)
            if not item:
                raise LookupError("Source change not found")
            now = utc_now()
            updated = store.update(item["PK"], item["SK"], "SET reviewState=:state, reviewedAt=:now, reviewedBy=:actor, reviewReason=:reason, GSI2PK=:gpk, GSI2SK=:gsk", {":state": "REJECTED", ":now": now, ":actor": owner_sub, ":reason": str(body["reason"])[:2000], ":gpk": "SOURCESTATE#REJECTED", ":gsk": f"{now}#{params['changeId']}"})
            return response(200, updated)
        params = _path_match(path, "/review/policy-versions/{versionId}/publish")
        if method == "POST" and params:
            return response(201, _publish_policy(store, params["versionId"], owner_sub, body))
        params = _path_match(path, "/review/policy-versions/{versionId}/rollback-pointer")
        if method == "POST" and params:
            return response(200, _rollback_policy_pointer(store, params["versionId"], owner_sub, body))

    return error_response(404, "NOT_FOUND", "Route not found", correlation_id(event))


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    corr = correlation_id(event)
    method, path = _route(event)
    LOGGER.info(json.dumps({"message": "request", "method": method, "path": path, "correlationId": corr}))
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": {"cache-control": "public, max-age=600"},
            "body": "",
        }
    try:
        return _handle(method, path, event, Store())
    except PermissionError as exc:
        return error_response(403, "FORBIDDEN", str(exc), corr)
    except LookupError as exc:
        return error_response(404, "NOT_FOUND", str(exc), corr)
    except ValueError as exc:
        return error_response(400, "VALIDATION_ERROR", str(exc), corr)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "AWS_ERROR")
        if code in {"ConditionalCheckFailedException", "TransactionCanceledException"}:
            return error_response(409, "CONFLICT", "The resource changed; refresh and retry", corr)
        LOGGER.exception("AWS request failed correlationId=%s code=%s", corr, code)
        return error_response(502, "DEPENDENCY_ERROR", "An AWS dependency failed", corr, retryable=True)
    except Exception:
        LOGGER.exception("Unhandled request error correlationId=%s", corr)
        return error_response(500, "INTERNAL_ERROR", "Unexpected server error", corr, retryable=False)

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.request import Request, urlopen

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

from common import settings
from common.store import Store
from common.util import new_id, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
agent_runtime = boto3.client("bedrock-agent-runtime")
bedrock_runtime = boto3.client("bedrock-runtime")

CATEGORIES = {
    "MISSING_DOCUMENT", "INCOME_MISMATCH", "NAME_MISMATCH", "INELIGIBLE_COURSE",
    "OTHER_SCHOLARSHIP_CONFLICT", "PERCENTILE_NOT_VERIFIED", "APPLICATION_DATA_ERROR",
    "DEADLINE_OR_PROCESS", "UNKNOWN",
}


def _fallback(reason: str, checks: list[dict[str, Any]]) -> dict[str, Any]:
    text = reason.casefold()
    mappings = [
        (("income", "salary"), "INCOME_MISMATCH", "Verify the declared family income against the current income certificate."),
        (("name", "mismatch", "spelling"), "NAME_MISMATCH", "Make the applicant name consistent across the form and evidence."),
        (("course", "diploma"), "INELIGIBLE_COURSE", "Verify that the course type is eligible under the current rules."),
        (("scholarship", "fee reimbursement"), "OTHER_SCHOLARSHIP_CONFLICT", "Confirm whether another scholarship or fee reimbursement is active."),
        (("percentile", "80th", "merit"), "PERCENTILE_NOT_VERIFIED", "Provide the official board percentile evidence required by the scheme."),
        (("deadline", "late", "closed"), "DEADLINE_OR_PROCESS", "Check the official portal timeline and escalation route."),
        (("missing document", "document not", "certificate not", "attachment", "upload"), "MISSING_DOCUMENT", "Add or replace the requested official document."),
    ]
    for words, category, action in mappings:
        if any(word in text for word in words):
            return {"category": category, "summary": reason[:500] or category.replace("_", " ").title(), "recommendedActions": [action], "confidence": 0.72}
    failed = [c for c in checks if c.get("status") in {"FAIL", "BLOCKED_MISSING_EVIDENCE", "NEEDS_REVIEW"}]
    for check in failed:
        identity = " ".join(str(check.get(key, "")) for key in ("ruleId", "message", "messageKey")).casefold()
        if "income" in identity:
            return {
                "category": "INCOME_MISMATCH",
                "summary": "The declared family income and the income-certificate value do not match.",
                "recommendedActions": ["Replace or correct the income certificate, or correct the declared income before resubmitting."],
                "confidence": 0.86,
            }
        if "name" in identity:
            return {
                "category": "NAME_MISMATCH",
                "summary": "The applicant name is inconsistent between the form and supporting evidence.",
                "recommendedActions": ["Make the applicant name consistent across the form and official evidence."],
                "confidence": 0.82,
            }
    if failed:
        return {"category": "APPLICATION_DATA_ERROR", "summary": failed[0].get("message", "A SevaFix check needs attention."), "recommendedActions": ["Review the failed checks and correct the draft or supporting evidence."], "confidence": 0.62}
    return {"category": "UNKNOWN", "summary": reason[:500] or "The rejection reason could not be classified safely.", "recommendedActions": ["Ask the issuing authority for the exact rejection reason before changing the application."], "confidence": 0.3}


def _retrieve(query: str, scheme_id: str, policy_version_id: str) -> list[dict[str, Any]]:
    if not settings.BEDROCK_KNOWLEDGE_BASE_ID:
        return []
    try:
        result = agent_runtime.retrieve(
            knowledgeBaseId=settings.BEDROCK_KNOWLEDGE_BASE_ID,
            retrievalQuery={"text": query[:1000]},
            retrievalConfiguration={"vectorSearchConfiguration": {
                "numberOfResults": 8,
                "filter": {"andAll": [
                    {"equals": {"key": "schemeId", "value": scheme_id}},
                    {"equals": {"key": "policyVersionId", "value": policy_version_id}},
                ]},
            }},
        )
    except Exception:
        LOGGER.exception("Knowledge base retrieval failed; diagnosis will fail closed to deterministic rules")
        return []
    passages = []
    for index, item in enumerate(result.get("retrievalResults", []), 1):
        location = item.get("location", {})
        uri = location.get("s3Location", {}).get("uri") or location.get("webLocation", {}).get("url")
        passages.append({"citationId": f"S{index}", "text": item.get("content", {}).get("text", "")[:2500], "uri": uri, "score": item.get("score")})
    return passages


def _claim_passages(store: Store, query: str, scheme_id: str, policy_version_id: str) -> list[dict[str, Any]]:
    claims = store.query(f"POLICY#{scheme_id}", begins_with=f"CLAIM#{policy_version_id}#")
    query_terms = {term for term in re.findall(r"[a-z0-9]+", query.casefold()) if len(term) > 2}
    ranked: list[tuple[int, dict[str, Any]]] = []
    for claim in claims:
        claim_terms = set(re.findall(r"[a-z0-9]+", str(claim.get("summary", "")).casefold()))
        ranked.append((len(query_terms.intersection(claim_terms)), claim))
    ranked.sort(key=lambda value: (value[0], value[1].get("claimId", "")), reverse=True)
    passages: list[dict[str, Any]] = []
    for index, (score, claim) in enumerate(ranked[:8], 1):
        source = store.get("SOURCES#REGISTRY", f"SOURCE#{claim.get('sourceId')}") or {}
        location = " ".join(
            part for part in [
                f"page {claim['page']}" if claim.get("page") else "",
                str(claim.get("section", "")),
            ] if part
        )
        passages.append({
            "citationId": f"C{index}",
            "text": f"{claim.get('summary', '')} Source location: {location or 'official source record'}.",
            "uri": source.get("url"),
            "score": score,
        })
    return passages


def _redact_for_ai(value: str) -> str:
    value = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[EMAIL]", value, flags=re.IGNORECASE)
    value = re.sub(r"(?<!\d)(?:\+?91[- ]?)?[6-9]\d{9}(?!\d)", "[PHONE]", value)
    return re.sub(r"(?<!\d)\d{8,}(?!\d)", "[IDENTIFIER]", value)


def _mantle_response(prompt: str) -> str:
    session = boto3.Session()
    region = session.region_name or "ap-south-1"
    url = f"https://bedrock-mantle.{region}.api.aws/v1/responses"
    body = json.dumps({
        "model": settings.BEDROCK_MANTLE_MODEL_ID,
        "input": prompt,
        "store": False,
        "max_output_tokens": 1000,
    }).encode("utf-8")
    request = AWSRequest(method="POST", url=url, data=body, headers={"content-type": "application/json"})
    credentials = session.get_credentials().get_frozen_credentials()
    SigV4Auth(credentials, "bedrock-mantle", region).add_auth(request)
    with urlopen(Request(url, method="POST", data=body, headers=dict(request.headers)), timeout=75) as response:
        payload = json.loads(response.read() or b"{}")
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return str(content["text"])
    raise ValueError("Bedrock Mantle response did not contain output text")


def _ai_diagnose(reason: str, checks: list[dict[str, Any]], passages: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not passages or not (settings.BEDROCK_MANTLE_MODEL_ID or settings.BEDROCK_MODEL_ID):
        return None
    evidence = "\n\n".join(f"[{p['citationId']}] {p['text']}" for p in passages)
    prompt = f"""You diagnose an Indian government benefit application rejection. Use only SOURCE text and failed checks. Never claim SevaFix is the issuing authority. Return JSON only with keys category, summary, recommendedActions (array), citedSourceIds (array), confidence (0..1). category must be one of {sorted(CATEGORIES)}. If evidence is insufficient use UNKNOWN.\n\nREJECTION:\n{_redact_for_ai(reason[:3000])}\n\nFAILED CHECKS:\n{json.dumps(checks, default=str)[:5000]}\n\nSOURCES:\n{evidence[:14000]}"""
    try:
        if settings.BEDROCK_MANTLE_MODEL_ID:
            raw = _mantle_response(prompt)
            used_model_id = settings.BEDROCK_MANTLE_MODEL_ID
        else:
            kwargs: dict[str, Any] = {
                "modelId": settings.BEDROCK_MODEL_ID,
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 1000, "temperature": 0.0},
            }
            if settings.BEDROCK_GUARDRAIL_ID:
                kwargs["guardrailConfig"] = {"guardrailIdentifier": settings.BEDROCK_GUARDRAIL_ID, "guardrailVersion": settings.BEDROCK_GUARDRAIL_VERSION, "trace": "enabled"}
            answer = bedrock_runtime.converse(**kwargs)
            raw = answer["output"]["message"]["content"][0]["text"]
            used_model_id = settings.BEDROCK_MODEL_ID
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group(0) if match else raw)
        category = str(parsed.get("category", "")).strip().upper()
        if category not in CATEGORIES:
            LOGGER.warning("Bedrock diagnosis rejected an invalid category: %s", category[:100])
            return None
        parsed["category"] = category
        allowed = {p["citationId"] for p in passages}
        raw_citations = parsed.get("citedSourceIds", [])
        if isinstance(raw_citations, str):
            raw_citations = re.findall(r"[A-Z]\d+", raw_citations.upper())
        cited = [str(c).upper() for c in raw_citations if str(c).upper() in allowed]
        if category != "UNKNOWN" and not cited and passages and float(passages[0].get("score") or 0) > 0:
            # The model's diagnosis remains grounded only when deterministic retrieval
            # found an overlapping verified claim. This repairs formatting omissions,
            # never a missing evidence match.
            cited = [passages[0]["citationId"]]
            LOGGER.warning("Bedrock omitted a valid citation ID; attached the top verified lexical match")
        if category != "UNKNOWN" and not cited:
            LOGGER.warning("Bedrock diagnosis rejected because it had no verified citation")
            return None
        parsed["citedSourceIds"] = cited
        parsed["confidence"] = max(0.0, min(1.0, float(parsed.get("confidence", 0))))
        parsed["usedModelId"] = used_model_id
        return parsed
    except Exception:
        LOGGER.exception("Bedrock diagnosis failed; deterministic fallback will be used")
        return None


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    store = Store()
    app_id, owner_sub = event["applicationId"], event["ownerSub"]
    meta = store.assert_owner(app_id, owner_sub)
    reason = str(event.get("reasonText") or "").strip()
    rejection_document_id = event.get("rejectionDocumentId")
    if rejection_document_id:
        document = store.get(f"APP#{app_id}", f"DOC#{rejection_document_id}", consistent=True)
        if not document or document.get("ownerSub") != owner_sub:
            raise LookupError("Rejection document not found")
        reason = (reason + "\n" + str(document.get("extractedText") or "")).strip()
    authority_reason_provided = bool(reason)
    all_items = store.query(f"APP#{app_id}")
    checks = [i for i in all_items if i["SK"].startswith("CHECK#") and i.get("runId") == meta.get("lastValidationRunId")]
    failed = [c for c in checks if c.get("status") != "PASS"]
    if not reason:
        reason = (
            "No official rejection reason was provided. Infer only likely application issues from the failed "
            "scheme checks and verified supporting documents. Clearly state that this is not an official rejection reason."
        )
    passages = _retrieve(reason, meta["schemeId"], meta["policyVersionId"])
    if not passages:
        passages = _claim_passages(store, reason, meta["schemeId"], meta["policyVersionId"])
    result = _ai_diagnose(reason, failed, passages) or _fallback(reason, failed)
    if not authority_reason_provided:
        deterministic = _fallback("", failed)
        if deterministic["category"] not in {"UNKNOWN", "APPLICATION_DATA_ERROR"} and result.get("category") != deterministic["category"]:
            LOGGER.warning(
                "AI category %s contradicted deterministic check category %s; deterministic result wins",
                result.get("category"),
                deterministic["category"],
            )
            result.update(deterministic)
    result["diagnosisBasis"] = "PROVIDED_REASON" if authority_reason_provided else "INFERRED_FROM_CHECKS"
    citation_ids = set(result.get("citedSourceIds", []))
    result["citations"] = [{k: p.get(k) for k in ("citationId", "uri", "score")} for p in passages if p["citationId"] in citation_ids]
    now = utc_now()
    item = {
        "PK": f"APP#{app_id}", "SK": f"DIAG#{event['diagnosisId']}", "entityType": "Diagnosis",
        "diagnosisId": event["diagnosisId"], "applicationId": app_id, "policyVersionId": meta["policyVersionId"],
        "reasonText": reason[:10000], "result": result, "status": "COMPLETED", "createdAt": now,
        "modelId": result.get("usedModelId") or settings.BEDROCK_MODEL_ID or "deterministic-fallback",
    }
    store.put(item, condition="attribute_not_exists(PK)")
    store.append_event(app_id, "REJECTION_DIAGNOSED", "SYSTEM", {"diagnosisId": event["diagnosisId"], "category": result["category"]}, event_id=new_id("evt"), occurred_at=now)
    if event.get("jobId"):
        store.update(f"USER#{owner_sub}", f"JOB#{event['jobId']}", "SET #status=:status, #result=:result, updatedAt=:now", {":status": "COMPLETED", ":result": {"diagnosisId": event["diagnosisId"], **result}, ":now": now}, names={"#status": "status", "#result": "result"})
    return item

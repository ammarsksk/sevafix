from __future__ import annotations

import json
import logging
from typing import Any

from common.rules import evaluate_rule, readiness
from common.store import Store
from common.util import new_id, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def _set_path(root: dict[str, Any], path: str, value: Any) -> None:
    current = root
    parts = path.split(".")
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = value


def _facts(meta: dict[str, Any], documents: list[dict[str, Any]]) -> tuple[dict[str, Any], set[str]]:
    result: dict[str, Any] = {}
    for key, value in meta.get("draftFields", {}).items():
        _set_path(result, key, value)
    evidence: set[str] = set()
    primary_name = None
    document_income = None
    for document in documents:
        if document.get("state") not in {"EXTRACTED", "NEEDS_USER_CONFIRMATION", "CONFIRMED"}:
            continue
        evidence.add(str(document.get("documentType")))
        for name, fact in (document.get("confirmedFacts") or document.get("extractedFacts", {})).items():
            value = fact.get("value") if isinstance(fact, dict) else fact
            if name == "primaryName" and not primary_name:
                primary_name = value
            if name == "annualIncomeINR" and document.get("documentType") == "INCOME_CERTIFICATE":
                document_income = value
    result.setdefault("document", {})["primaryName"] = primary_name
    result["document"]["annualIncomeINR"] = document_income
    return result, evidence


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    store = Store()
    app_id = event["applicationId"]
    owner_sub = event["ownerSub"]
    job_id = event.get("jobId")
    meta = store.assert_owner(app_id, owner_sub)
    documents = [item for item in store.query(f"APP#{app_id}", begins_with="DOC#") if item.get("state") != "DELETED"]
    rules = store.query(f"RULESET#{meta['policyVersionId']}", begins_with="RULE#")
    facts, evidence = _facts(meta, documents)
    run_id = new_id("run")
    now = utc_now()
    results: list[dict[str, Any]] = []
    for rule in rules:
        result = evaluate_rule(rule, facts, evidence)
        complete = {
            **result,
            "ruleId": rule["ruleId"],
            "severity": rule.get("severity", "BLOCKING"),
            "sourceRefs": rule.get("sourceRefs", []),
            "messageKey": rule.get("messageKey"),
        }
        results.append(complete)
        store.put({
            "PK": f"APP#{app_id}", "SK": f"CHECK#{run_id}#{rule['ruleId']}", "entityType": "CheckResult",
            "runId": run_id, "applicationId": app_id, "policyVersionId": meta["policyVersionId"],
            "engineVersion": "rules-engine@1.0.0", "evaluatedAt": now, **complete,
        })
    summary = readiness(results)
    store.put({
        "PK": f"APP#{app_id}", "SK": f"RUN#{run_id}", "entityType": "ValidationRun", "runId": run_id,
        "policyVersionId": meta["policyVersionId"], "engineVersion": "rules-engine@1.0.0", "status": "COMPLETED",
        "summary": summary, "createdAt": now,
    })
    store.update(f"APP#{app_id}", "META", "SET readinessSummary=:summary, lifecycleStatus=:status, lastValidationRunId=:run, updatedAt=:now", {":summary": summary, ":status": summary["label"], ":run": run_id, ":now": now, ":owner": owner_sub}, condition="ownerSub=:owner")
    store.append_event(app_id, "VALIDATION_COMPLETED", "SYSTEM", {"runId": run_id, "summary": summary}, event_id=new_id("evt"), occurred_at=now)
    if job_id:
        store.update(f"USER#{owner_sub}", f"JOB#{job_id}", "SET #status=:status, #result=:result, updatedAt=:now", {":status": "COMPLETED", ":result": {"runId": run_id, "summary": summary}, ":now": now}, names={"#status": "status", "#result": "result"})
    LOGGER.info(json.dumps({"message": "validation completed", "applicationId": app_id, "runId": run_id, "summary": summary}))
    return {"applicationId": app_id, "runId": run_id, "summary": summary}

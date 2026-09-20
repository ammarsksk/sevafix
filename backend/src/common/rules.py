from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Any

from common.util import normalize_name


PASS = "PASS"
FAIL = "FAIL"
NEEDS_REVIEW = "NEEDS_REVIEW"
NOT_APPLICABLE = "NOT_APPLICABLE"
BLOCKED_MISSING_EVIDENCE = "BLOCKED_MISSING_EVIDENCE"
BLOCKED_SOURCE_STALE = "BLOCKED_SOURCE_STALE"


def get_path(facts: dict[str, Any], path: str) -> Any:
    current: Any = facts
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _number(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        if isinstance(value, str):
            value = re.sub(r"[^0-9.\-]", "", value.replace(",", ""))
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None


def compare(actual: Any, op: str, expected: Any) -> tuple[str, str]:
    op = op.upper()
    if op == "PRESENT":
        return (PASS, "Value is present") if actual not in (None, "", [], {}) else (BLOCKED_MISSING_EVIDENCE, "Required value is missing")
    if actual is None:
        return BLOCKED_MISSING_EVIDENCE, "Required value is missing"
    if op == "EQ":
        ok = actual == expected
    elif op == "NEQ":
        ok = actual != expected
    elif op in {"LT", "LTE", "GT", "GTE"}:
        left, right = _number(actual), _number(expected)
        if left is None or right is None:
            return NEEDS_REVIEW, "Value could not be interpreted as a number"
        ok = {"LT": left < right, "LTE": left <= right, "GT": left > right, "GTE": left >= right}[op]
    elif op == "IN":
        ok = actual in expected
    elif op == "NOT_IN":
        ok = actual not in expected
    elif op == "DATE_BETWEEN":
        parsed = _date(actual)
        start, end = _date(expected[0]), _date(expected[1])
        if not parsed or not start or not end:
            return NEEDS_REVIEW, "Date could not be interpreted"
        ok = start <= parsed <= end
    elif op == "NAME_SIMILAR":
        left, right = normalize_name(str(actual)), normalize_name(str(expected))
        if not left or not right:
            return BLOCKED_MISSING_EVIDENCE, "A name is missing"
        score = SequenceMatcher(a=left, b=right).ratio()
        if score >= 0.94:
            return PASS, f"Names match ({score:.2f})"
        if score >= 0.78:
            return NEEDS_REVIEW, f"Names may refer to the same person ({score:.2f})"
        return FAIL, f"Names do not match ({score:.2f})"
    else:
        raise ValueError(f"Unsupported rule operator: {op}")
    return (PASS, "Rule passed") if ok else (FAIL, "Rule failed")


def condition_applies(condition: dict[str, Any] | None, facts: dict[str, Any]) -> bool:
    if not condition:
        return True
    status, _ = compare(get_path(facts, condition["field"]), condition["op"], condition.get("value"))
    return status == PASS


def evaluate_rule(rule: dict[str, Any], facts: dict[str, Any], evidence_types: set[str] | None = None) -> dict[str, Any]:
    if not condition_applies(rule.get("appliesWhen"), facts):
        return {"status": NOT_APPLICABLE, "message": "Rule does not apply"}
    required = set(rule.get("requiredEvidence", []))
    if required and not required.issubset(evidence_types or set()):
        return {
            "status": BLOCKED_MISSING_EVIDENCE,
            "message": "Required evidence is missing",
            "missingEvidence": sorted(required.difference(evidence_types or set())),
        }
    assertion = rule["assert"]
    actual = get_path(facts, assertion["field"])
    expected = assertion.get("value")
    if "otherField" in assertion:
        expected = get_path(facts, assertion["otherField"])
    status, message = compare(actual, assertion["op"], expected)
    return {
        "status": status,
        "message": message,
        "actual": actual,
        "expected": expected,
        "actualField": assertion["field"],
        "expectedField": assertion.get("otherField", "rule.value"),
    }


def readiness(results: list[dict[str, Any]]) -> dict[str, Any]:
    applicable = [r for r in results if r["status"] != NOT_APPLICABLE]
    passed = sum(1 for r in applicable if r["status"] == PASS)
    blocking = [r for r in applicable if r.get("severity", "BLOCKING") == "BLOCKING" and r["status"] != PASS]
    return {
        "passed": passed,
        "applicable": len(applicable),
        "failed": sum(1 for r in applicable if r["status"] == FAIL),
        "needsReview": sum(1 for r in applicable if r["status"] == NEEDS_REVIEW),
        "blocked": sum(1 for r in applicable if r["status"].startswith("BLOCKED_")),
        "ready": not blocking and bool(applicable),
        "label": "READY_WITH_SEVAFIX_CHECKS" if not blocking and applicable else "ACTION_REQUIRED",
    }

from __future__ import annotations

import base64
import hashlib
import json
import re
import unicodedata
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        if isinstance(obj, set):
            return sorted(obj)
        return super().default(obj)


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def json_dumps(value: Any) -> str:
    return json.dumps(value, cls=DecimalEncoder, separators=(",", ":"), ensure_ascii=False)


def parse_body(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body")
    if not body:
        return {}
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, dict):
        return body
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise ValueError("JSON body must be an object")
    return parsed


def response(status: int, body: Any, *, headers: dict[str, str] | None = None) -> dict[str, Any]:
    default_headers = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
    }
    if headers:
        default_headers.update(headers)
    return {"statusCode": status, "headers": default_headers, "body": json_dumps(body)}


def error_response(status: int, code: str, message: str, correlation_id: str, **details: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {"code": code, "message": message, "correlationId": correlation_id}
    }
    if details:
        payload["error"]["details"] = details
    return response(status, payload)


def correlation_id(event: dict[str, Any]) -> str:
    request_context = event.get("requestContext", {})
    return request_context.get("requestId") or event.get("correlationId") or new_id("corr")


def claims(event: dict[str, Any]) -> dict[str, Any]:
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )


def subject(event: dict[str, Any]) -> str:
    value = claims(event).get("sub")
    if not value:
        raise PermissionError("Authenticated subject is missing")
    return str(value)


def groups(event: dict[str, Any]) -> set[str]:
    raw = claims(event).get("cognito:groups", "")
    if isinstance(raw, list):
        return {str(item) for item in raw}
    return {part.strip() for part in str(raw).strip("[]").split(",") if part.strip()}


def require_group(event: dict[str, Any], allowed: set[str]) -> None:
    if not groups(event).intersection(allowed):
        raise PermissionError("Reviewer or administrator access is required")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_hash(value: Any) -> str:
    return sha256_bytes(json_dumps(value).encode("utf-8"))


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value).casefold()
    text = re.sub(r"\b(mr|mrs|ms|miss|dr|shri|smt)\.?\b", " ", text)
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", text).split())


def normalize_text(value: str | None) -> str:
    return " ".join(unicodedata.normalize("NFKC", value or "").strip().split())


def hmac_display(value: str, salt: str = "sevafix-display-v1") -> str:
    digest = hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()
    return digest[:24]


def redact_identifier(value: str | None, visible: int = 4) -> str | None:
    if not value:
        return value
    compact = re.sub(r"\s+", "", value)
    if len(compact) <= visible:
        return "*" * len(compact)
    return "*" * (len(compact) - visible) + compact[-visible:]


def item_size_safe(value: Any, max_chars: int = 300_000) -> Any:
    encoded = json_dumps(value)
    if len(encoded) > max_chars:
        raise ValueError("Payload is too large for DynamoDB")
    return value

from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import re
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

import boto3

from common import settings
from common.store import Store
from common.util import new_id, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
s3 = boto3.client("s3")
API_KEY_PATTERN = re.compile(r"(?i)(api-key=)[^&\s]+")


class _VisibleTextParser(HTMLParser):
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


def _content_digest(body: bytes, content_type: str, source_kind: str = "WEB") -> str:
    if source_kind == "DATA_GOV_API":
        try:
            normalized = json.dumps(json.loads(body), sort_keys=True, separators=(",", ":"))
            return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    if "html" not in content_type.casefold():
        return hashlib.sha256(body).hexdigest()
    parser = _VisibleTextParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    visible = " ".join(" ".join(parser.parts).split()).casefold()
    return hashlib.sha256(visible.encode("utf-8")).hexdigest()


def _safe_host(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Official source must be a credential-free HTTPS URL")
    for result in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if not address.is_global:
            raise ValueError("Official source resolved to a non-public address")
    return parsed.hostname.casefold()


def _request_url(url: str, source_kind: str = "WEB") -> str:
    if source_kind == "DATA_GOV_API":
        if not settings.DATA_GOV_API_KEY:
            raise RuntimeError("DATA_GOV_API_KEY is not configured")
        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query["api-key"] = settings.DATA_GOV_API_KEY
        return urlunparse(parsed._replace(query=urlencode(query)))
    return url


def _safe_error(exc: Exception) -> str:
    return API_KEY_PATTERN.sub(r"\1<redacted>", str(exc))[:1000]


def _fetch(url: str, source_kind: str = "WEB") -> tuple[bytes, dict[str, str]]:
    url = _request_url(url, source_kind)
    allowed_host = _safe_host(url)
    request = Request(
        url,
        headers={
            "User-Agent": "SevaFix-Policy-Monitor/1.0",
            "Accept": "application/json,text/html,application/pdf,text/plain,*/*",
        },
    )
    with urlopen(request, timeout=20) as response:
        final_host = _safe_host(response.geturl())
        if final_host != allowed_host and not final_host.endswith(f".{allowed_host}") and not allowed_host.endswith(f".{final_host}"):
            raise ValueError("Official source redirected outside its approved host")
        body = response.read(15 * 1024 * 1024 + 1)
        if len(body) > 15 * 1024 * 1024:
            raise ValueError("Official source exceeds the 15 MB monitoring limit")
        return body, {k.lower(): v for k, v in response.headers.items()}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    store = Store()
    sources = store.query("SOURCES#REGISTRY", begins_with="SOURCE#")
    changed, checked, failed = 0, 0, 0
    for source in sources:
        if not source.get("enabled", True):
            continue
        checked += 1
        now = utc_now()
        try:
            source_kind = source.get("sourceKind", "WEB")
            body, headers = _fetch(source["url"], source_kind)
            digest = _content_digest(body, headers.get("content-type", ""), source_kind)
            store.update(source["PK"], source["SK"], "SET lastCheckedAt=:now, lastHttpStatus=:status, lastError=:empty", {":now": now, ":status": 200, ":empty": ""})
            if digest in {source.get("contentSha256"), source.get("observedSha256")}:
                continue
            change_id = new_id("chg")
            key = f"source-snapshots/{source['sourceId']}/{now[:10]}/{change_id}"
            s3.put_object(Bucket=settings.POLICY_BUCKET, Key=key, Body=body, ContentType=headers.get("content-type", "application/octet-stream"))
            change = {
                "PK": f"SOURCECHANGE#{change_id}", "SK": "META", "entityType": "SourceChange", "changeId": change_id,
                "sourceId": source["sourceId"], "schemeId": source.get("schemeId"), "url": source["url"],
                "previousSha256": source.get("contentSha256"), "contentSha256": digest, "snapshotKey": key,
                "reviewState": "CHANGED", "detectedAt": now, "GSI2PK": "SOURCESTATE#CHANGED", "GSI2SK": f"{now}#{change_id}",
            }
            store.put(change, condition="attribute_not_exists(PK)")
            store.update(source["PK"], source["SK"], "SET observedSha256=:digest, lastChangedAt=:now, pendingChangeId=:change", {":digest": digest, ":now": now, ":change": change_id})
            changed += 1
        except Exception as exc:
            failed += 1
            error = _safe_error(exc)
            LOGGER.error("Source check failed sourceId=%s error=%s", source.get("sourceId"), error)
            store.update(source["PK"], source["SK"], "SET lastCheckedAt=:now, lastError=:error", {":now": now, ":error": error})
    return {"checked": checked, "changed": changed, "failed": failed}

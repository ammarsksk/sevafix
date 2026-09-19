from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import boto3

from common import settings
from common.store import Store
from common.util import new_id, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
s3 = boto3.client("s3")


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


def _content_digest(body: bytes, content_type: str) -> str:
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


def _fetch(url: str) -> tuple[bytes, dict[str, str]]:
    allowed_host = _safe_host(url)
    request = Request(url, headers={"User-Agent": "SevaFix-Policy-Monitor/1.0", "Accept": "text/html,application/pdf,text/plain,*/*"})
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
            body, headers = _fetch(source["url"])
            digest = _content_digest(body, headers.get("content-type", ""))
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
            LOGGER.exception("Source check failed sourceId=%s", source.get("sourceId"))
            store.update(source["PK"], source["SK"], "SET lastCheckedAt=:now, lastError=:error", {":now": now, ":error": str(exc)[:1000]})
    return {"checked": checked, "changed": changed, "failed": failed}

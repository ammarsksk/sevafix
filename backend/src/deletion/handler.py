from __future__ import annotations

import logging
from typing import Any

import boto3

from common import settings
from common.store import Store
from common.util import hmac_display, utc_now


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
s3 = boto3.client("s3")
cognito = boto3.client("cognito-idp")


def _delete_partition(store: Store, pk: str) -> int:
    count = 0
    while True:
        items = store.query(pk, limit=25)
        if not items:
            return count
        with store.table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                count += 1


def _delete_prefix(bucket: str, prefix: str) -> int:
    count = 0
    paginator = s3.get_paginator("list_object_versions")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{"Key": o["Key"], "VersionId": o["VersionId"]} for o in page.get("Versions", []) + page.get("DeleteMarkers", [])]
        for offset in range(0, len(objects), 1000):
            part = objects[offset:offset + 1000]
            if part:
                s3.delete_objects(Bucket=bucket, Delete={"Objects": part, "Quiet": True})
                count += len(part)
    return count


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    store = Store()
    owner = event["ownerSub"]
    summaries = store.query(f"USER#{owner}", begins_with="APP#")
    app_ids = sorted({item["appId"] for item in summaries if item.get("appId")})
    deleted_items = 0
    document_ids: list[str] = []
    for app_id in app_ids:
        document_ids.extend(item["documentId"] for item in store.query(f"APP#{app_id}", begins_with="DOC#") if item.get("documentId"))
        deleted_items += _delete_partition(store, f"APP#{app_id}")
    deleted_objects = _delete_prefix(settings.CITIZEN_BUCKET, f"users/{hmac_display(owner)}/")
    deleted_items += _delete_partition(store, f"USER#{owner}")
    for document_id in document_ids:
        store.delete(f"DOC#{document_id}", "LOOKUP")
    if settings.USER_POOL_ID:
        users = cognito.list_users(UserPoolId=settings.USER_POOL_ID, Filter=f'sub = "{owner}"', Limit=1).get("Users", [])
        if users:
            cognito.admin_delete_user(UserPoolId=settings.USER_POOL_ID, Username=users[0]["Username"])
    LOGGER.info("Deletion complete ownerHash=%s", hmac_display(owner))
    return {"status": "COMPLETED", "deletedApplications": len(app_ids), "deletedItems": deleted_items, "deletedObjects": deleted_objects, "completedAt": utc_now()}

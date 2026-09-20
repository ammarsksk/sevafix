from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from common.settings import TABLE_NAME
from common.util import utc_now


def _to_decimal(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _to_decimal(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_decimal(v) for v in value]
    return value


class Store:
    def __init__(self, table_name: str | None = None, dynamodb: Any | None = None) -> None:
        resource = dynamodb or boto3.resource("dynamodb")
        self.table = resource.Table(table_name or TABLE_NAME)
        self.client = self.table.meta.client

    def get(self, pk: str, sk: str, *, consistent: bool = False) -> dict[str, Any] | None:
        result = self.table.get_item(
            Key={"PK": pk, "SK": sk}, ConsistentRead=consistent
        )
        return result.get("Item")

    def put(self, item: dict[str, Any], *, condition: str | None = None, values: dict[str, Any] | None = None) -> None:
        kwargs: dict[str, Any] = {"Item": _to_decimal(item)}
        if condition:
            kwargs["ConditionExpression"] = condition
        if values:
            kwargs["ExpressionAttributeValues"] = _to_decimal(values)
        self.table.put_item(**kwargs)

    def delete(self, pk: str, sk: str, *, condition: str | None = None, values: dict[str, Any] | None = None) -> None:
        kwargs: dict[str, Any] = {"Key": {"PK": pk, "SK": sk}}
        if condition:
            kwargs["ConditionExpression"] = condition
        if values:
            kwargs["ExpressionAttributeValues"] = _to_decimal(values)
        self.table.delete_item(**kwargs)

    def query(self, pk: str, *, begins_with: str | None = None, limit: int | None = None, forward: bool = True, consistent: bool = False) -> list[dict[str, Any]]:
        expression = Key("PK").eq(pk)
        if begins_with:
            expression &= Key("SK").begins_with(begins_with)
        kwargs: dict[str, Any] = {
            "KeyConditionExpression": expression,
            "ScanIndexForward": forward,
            "ConsistentRead": consistent,
        }
        if limit:
            kwargs["Limit"] = limit
        return self.table.query(**kwargs).get("Items", [])

    def query_index(self, index: str, pk_name: str, pk: str, *, begins_with_name: str | None = None, begins_with_value: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        expression = Key(pk_name).eq(pk)
        if begins_with_name and begins_with_value:
            expression &= Key(begins_with_name).begins_with(begins_with_value)
        return self.table.query(
            IndexName=index,
            KeyConditionExpression=expression,
            Limit=limit,
        ).get("Items", [])

    def update(self, pk: str, sk: str, update_expression: str, values: dict[str, Any], *, names: dict[str, str] | None = None, condition: str | None = None, return_values: str = "ALL_NEW") -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "Key": {"PK": pk, "SK": sk},
            "UpdateExpression": update_expression,
            "ExpressionAttributeValues": _to_decimal(values),
            "ReturnValues": return_values,
        }
        if names:
            kwargs["ExpressionAttributeNames"] = names
        if condition:
            kwargs["ConditionExpression"] = condition
        return self.table.update_item(**kwargs).get("Attributes", {})

    def transact(self, actions: list[dict[str, Any]]) -> None:
        native: list[dict[str, Any]] = []
        for action in actions:
            if "Put" in action:
                put = dict(action["Put"])
                put.setdefault("TableName", self.table.name)
                put["Item"] = _to_decimal(put["Item"])
                if "ExpressionAttributeValues" in put:
                    put["ExpressionAttributeValues"] = _to_decimal(put["ExpressionAttributeValues"])
                native.append({"Put": put})
            elif "Update" in action:
                update = dict(action["Update"])
                update.setdefault("TableName", self.table.name)
                update["Key"] = _to_decimal(update["Key"])
                if "ExpressionAttributeValues" in update:
                    update["ExpressionAttributeValues"] = _to_decimal(update["ExpressionAttributeValues"])
                native.append({"Update": update})
            elif "Delete" in action:
                delete = dict(action["Delete"])
                delete.setdefault("TableName", self.table.name)
                delete["Key"] = _to_decimal(delete["Key"])
                native.append({"Delete": delete})
            else:
                raise ValueError("Unsupported transaction action")
        self.client.transact_write_items(TransactItems=native)

    def assert_owner(self, app_id: str, owner_sub: str) -> dict[str, Any]:
        item = self.get(f"APP#{app_id}", "META", consistent=True)
        if not item or item.get("ownerSub") != owner_sub:
            raise LookupError("Application not found")
        return item

    def append_event(self, app_id: str, event_type: str, actor: str, payload: dict[str, Any] | None = None, *, event_id: str, occurred_at: str | None = None) -> dict[str, Any]:
        timestamp = occurred_at or utc_now()
        item = {
            "PK": f"APP#{app_id}",
            "SK": f"EVENT#{timestamp}#{event_id}",
            "entityType": "TimelineEvent",
            "eventId": event_id,
            "eventType": event_type,
            "actor": actor,
            "payload": payload or {},
            "occurredAt": timestamp,
        }
        self.put(item, condition="attribute_not_exists(PK)")
        return item

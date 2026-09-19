from __future__ import annotations

import json
import logging
from typing import Any

import boto3

from common import settings


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
sns = boto3.client("sns")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    delivered = 0
    for record in event.get("Records", []):
        payload = json.loads(record["body"])
        if not settings.NOTIFICATION_TOPIC_ARN:
            LOGGER.info("Notification sink disabled type=%s", payload.get("type"))
            continue
        sns.publish(
            TopicArn=settings.NOTIFICATION_TOPIC_ARN,
            Subject=f"SevaFix: {payload.get('title', 'application update')}"[:100],
            Message=json.dumps(payload, ensure_ascii=False, default=str),
            MessageAttributes={"notificationType": {"DataType": "String", "StringValue": str(payload.get("type", "GENERAL"))}},
        )
        delivered += 1
    return {"delivered": delivered}

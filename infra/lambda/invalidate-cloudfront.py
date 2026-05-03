import os
import time
import uuid

import boto3


def handler(event, context):
    distribution_id = os.environ.get("DISTRIBUTION_ID", "").strip()
    paths_raw = os.environ.get("INVALIDATION_PATHS", "/*")

    if not distribution_id:
        raise ValueError("DISTRIBUTION_ID environment variable is required")

    paths = [item.strip() for item in paths_raw.split(",") if item.strip()]
    if not paths:
        paths = ["/*"]

    client = boto3.client("cloudfront")

    caller_reference = f"amplify-deploy-{int(time.time())}-{uuid.uuid4()}"

    response = client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {
                "Quantity": len(paths),
                "Items": paths,
            },
            "CallerReference": caller_reference,
        },
    )

    invalidation_id = response["Invalidation"]["Id"]

    return {
        "statusCode": 200,
        "distributionId": distribution_id,
        "invalidationId": invalidation_id,
        "paths": paths,
    }

from __future__ import annotations

import argparse
import json
from urllib.request import Request, urlopen

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


def signed_request(session: boto3.Session, method: str, url: str, body: bytes | None = None) -> dict:
    request = AWSRequest(
        method=method,
        url=url,
        data=body,
        headers={"content-type": "application/json"} if body is not None else {},
    )
    credentials = session.get_credentials().get_frozen_credentials()
    SigV4Auth(credentials, "bedrock-mantle", session.region_name).add_auth(request)
    with urlopen(Request(url, method=method, data=body, headers=dict(request.headers)), timeout=60) as response:
        return json.loads(response.read() or b"{}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Read or invoke models through the Bedrock Mantle endpoint")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--model")
    parser.add_argument("--prompt", default="Return JSON only: {\"status\":\"ok\"}")
    parser.add_argument("--max-output-tokens", type=int, default=128)
    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    base_url = f"https://bedrock-mantle.{args.region}.api.aws/v1"
    if args.model:
        body = json.dumps(
            {
                "model": args.model,
                "input": args.prompt,
                "store": False,
                "max_output_tokens": args.max_output_tokens,
            }
        ).encode("utf-8")
        result = signed_request(session, "POST", f"{base_url}/responses", body)
    else:
        result = signed_request(session, "GET", f"{base_url}/models")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

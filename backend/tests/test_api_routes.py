from api.app import _route, lambda_handler


def test_route_strips_named_api_gateway_stage():
    assert _route({"rawPath": "/dev/health", "requestContext": {"stage": "dev", "http": {"method": "GET"}}}) == ("GET", "/health")


def test_route_preserves_default_stage_path():
    assert _route({"rawPath": "/health", "requestContext": {"stage": "$default", "http": {"method": "GET"}}}) == ("GET", "/health")


def test_cors_preflight_does_not_require_a_user_or_aws_clients():
    result = lambda_handler(
        {
            "rawPath": "/dev/schemes",
            "requestContext": {"stage": "dev", "http": {"method": "OPTIONS"}},
        },
        None,
    )

    assert result == {
        "statusCode": 204,
        "headers": {"cache-control": "public, max-age=600"},
        "body": "",
    }

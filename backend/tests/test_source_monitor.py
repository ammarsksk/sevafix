import pytest
from urllib.parse import parse_qs, urlparse

from source_monitor import handler


def test_source_monitor_accepts_public_https(monkeypatch):
    monkeypatch.setattr(handler.socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))])
    assert handler._safe_host("https://education.gov.in/scheme") == "education.gov.in"


@pytest.mark.parametrize("url", ["http://example.gov.in/x", "https://user:pass@example.gov.in/x"])
def test_source_monitor_rejects_unsafe_urls(monkeypatch, url):
    monkeypatch.setattr(handler.socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))])
    with pytest.raises(ValueError):
        handler._safe_host(url)


def test_source_monitor_rejects_private_resolution(monkeypatch):
    monkeypatch.setattr(handler.socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("127.0.0.1", 443))])
    with pytest.raises(ValueError):
        handler._safe_host("https://official.example/path")


def test_html_digest_ignores_scripts_styles_and_attributes():
    first = b'<html><script>nonce=one</script><body data-token="one">Scheme income cap: 450000</body></html>'
    second = b'<html><script>nonce=two</script><style>.x{}</style><body data-token="two"> Scheme  income cap: 450000 </body></html>'
    assert handler._content_digest(first, "text/html") == handler._content_digest(second, "text/html; charset=utf-8")


def test_data_gov_request_adds_key_only_at_fetch_time(monkeypatch):
    monkeypatch.setattr(handler.settings, "DATA_GOV_API_KEY", "server-secret")
    request_url = handler._request_url(
        "https://api.data.gov.in/resource/resource-id?format=json&limit=10",
        "DATA_GOV_API",
    )
    query = parse_qs(urlparse(request_url).query)
    assert query["api-key"] == ["server-secret"]
    assert query["format"] == ["json"]
    assert query["limit"] == ["10"]


def test_data_gov_request_requires_server_key(monkeypatch):
    monkeypatch.setattr(handler.settings, "DATA_GOV_API_KEY", "")
    with pytest.raises(RuntimeError, match="DATA_GOV_API_KEY is not configured"):
        handler._request_url("https://api.data.gov.in/resource/resource-id", "DATA_GOV_API")


def test_source_errors_redact_api_keys():
    error = handler._safe_error(
        RuntimeError("request failed https://api.data.gov.in/resource/id?api-key=server-secret&format=json")
    )
    assert "server-secret" not in error
    assert "api-key=<redacted>" in error

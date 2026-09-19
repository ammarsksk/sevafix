from diagnosis import handler
from diagnosis.handler import _fallback


def test_deterministic_diagnosis_for_income_reason():
    result = _fallback("Rejected because family income does not match certificate", [])
    assert result["category"] == "INCOME_MISMATCH"
    assert result["recommendedActions"]


def test_unknown_does_not_invent_cause():
    result = _fallback("Code 47", [])
    assert result["category"] == "UNKNOWN"


def test_income_mismatch_is_inferred_from_failed_check_without_rejection_reason():
    result = _fallback(
        "No official rejection reason was provided.",
        [{"ruleId": "fresh-income-certificate-match", "status": "FAIL", "actual": 350000, "expected": 900000}],
    )
    assert result["category"] == "INCOME_MISMATCH"
    assert "income" in result["summary"].casefold()


def test_retrieval_failure_fails_closed(monkeypatch):
    monkeypatch.setattr(handler.settings, "BEDROCK_KNOWLEDGE_BASE_ID", "kb-test")
    monkeypatch.setattr(handler.agent_runtime, "retrieve", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("not ingested")))
    assert handler._retrieve("income mismatch", "scheme", "version") == []


def test_verified_claims_are_ranked_as_grounding_fallback():
    class FakeStore:
        def query(self, pk, begins_with=None):
            assert pk == "POLICY#scheme"
            return [
                {"claimId": "course", "summary": "Course must be regular", "sourceId": "guidelines"},
                {"claimId": "income", "summary": "Family income must not exceed the limit", "sourceId": "guidelines", "page": 2},
            ]

        def get(self, pk, sk):
            return {"url": "https://example.gov/guidelines.pdf"}

    passages = handler._claim_passages(FakeStore(), "income certificate mismatch", "scheme", "version")
    assert passages[0]["citationId"] == "C1"
    assert "income" in passages[0]["text"].casefold()
    assert passages[0]["uri"].startswith("https://")


def test_mantle_diagnosis_is_cited_and_records_model(monkeypatch):
    monkeypatch.setattr(handler.settings, "BEDROCK_MANTLE_MODEL_ID", "openai.gpt-oss-20b")
    monkeypatch.setattr(
        handler,
        "_mantle_response",
        lambda prompt: '{"category":"INCOME_MISMATCH","summary":"Income mismatch","recommendedActions":["Check certificate"],"citedSourceIds":["C1"],"confidence":0.9}',
    )
    result = handler._ai_diagnose(
        "income mismatch",
        [],
        [{"citationId": "C1", "text": "Income cap is INR 450000", "uri": "https://example.gov", "score": 1}],
    )
    assert result["category"] == "INCOME_MISMATCH"
    assert result["citedSourceIds"] == ["C1"]
    assert result["usedModelId"] == "openai.gpt-oss-20b"


def test_mantle_citation_format_omission_uses_only_positive_verified_match(monkeypatch):
    monkeypatch.setattr(handler.settings, "BEDROCK_MANTLE_MODEL_ID", "openai.gpt-oss-20b")
    monkeypatch.setattr(
        handler,
        "_mantle_response",
        lambda prompt: '{"category":"income_mismatch","summary":"Income mismatch","recommendedActions":["Check certificate"],"citedSourceIds":[],"confidence":0.8}',
    )
    result = handler._ai_diagnose(
        "income mismatch",
        [],
        [{"citationId": "C1", "text": "Income cap is INR 450000", "uri": "https://example.gov", "score": 2}],
    )
    assert result["category"] == "INCOME_MISMATCH"
    assert result["citedSourceIds"] == ["C1"]


def test_mantle_uncited_answer_without_evidence_match_fails_closed(monkeypatch):
    monkeypatch.setattr(handler.settings, "BEDROCK_MANTLE_MODEL_ID", "openai.gpt-oss-20b")
    monkeypatch.setattr(
        handler,
        "_mantle_response",
        lambda prompt: '{"category":"INCOME_MISMATCH","summary":"Income mismatch","recommendedActions":[],"citedSourceIds":[],"confidence":0.8}',
    )
    result = handler._ai_diagnose(
        "unrelated",
        [],
        [{"citationId": "C1", "text": "Course must be regular", "uri": "https://example.gov", "score": 0}],
    )
    assert result is None


def test_ai_redaction_removes_common_direct_identifiers():
    redacted = handler._redact_for_ai("Email aditi@example.com phone 9876543210 id 123456789012")
    assert "aditi@example.com" not in redacted
    assert "9876543210" not in redacted
    assert "123456789012" not in redacted

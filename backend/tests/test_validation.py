from validation.handler import _facts


def _income_document(document_id: str, income: int, confirmed_at: str, state: str = "CONFIRMED") -> dict:
    return {
        "SK": f"DOC#{document_id}",
        "documentType": "INCOME_CERTIFICATE",
        "state": state,
        "confirmedAt": confirmed_at,
        "confirmedFacts": {"annualIncomeINR": {"value": income}},
    }


def test_latest_confirmed_income_certificate_supersedes_older_certificate():
    documents = [
        _income_document("z-old-random-id", 900000, "2026-09-20T11:20:09.197Z"),
        _income_document("a-new-random-id", 350000, "2026-09-20T11:27:02.900Z"),
    ]

    facts, evidence = _facts({"draftFields": {"student.familyAnnualIncomeINR": 350000}}, documents)

    assert facts["document"]["annualIncomeINR"] == 350000
    assert evidence == {"INCOME_CERTIFICATE"}


def test_confirmed_income_beats_newer_unconfirmed_extraction():
    documents = [
        _income_document("confirmed", 350000, "2026-09-20T11:27:02.900Z"),
        {
            "SK": "DOC#unconfirmed",
            "documentType": "INCOME_CERTIFICATE",
            "state": "EXTRACTED",
            "updatedAt": "2026-09-20T11:30:00.000Z",
            "extractedFacts": {"annualIncomeINR": {"value": 900000}},
        },
    ]

    facts, _ = _facts({"draftFields": {}}, documents)

    assert facts["document"]["annualIncomeINR"] == 350000

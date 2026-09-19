from decimal import Decimal

from pipeline.handler import _normalize, _parse_money, _query_answers


def test_money_parser_handles_indian_format():
    assert _parse_money("₹ 4,50,000 per annum") == 450000


def test_textract_query_normalization():
    blocks = [
        {"Id": "q1", "BlockType": "QUERY", "Query": {"Alias": "APPLICANT_NAME"}, "Relationships": [{"Type": "ANSWER", "Ids": ["a1"]}]},
        {"Id": "a1", "BlockType": "QUERY_RESULT", "Text": "  Aditi   Sharma ", "Confidence": 99.2, "Page": 1},
        {"Id": "l1", "BlockType": "LINE", "Text": "Aditi Sharma", "Confidence": 99},
    ]
    assert _query_answers(blocks)["APPLICANT_NAME"]["value"] == "Aditi Sharma"
    facts, text, confidence = _normalize(blocks)
    assert facts["primaryName"]["value"] == "Aditi Sharma"
    assert text == "Aditi Sharma"
    assert confidence == Decimal("99.2")

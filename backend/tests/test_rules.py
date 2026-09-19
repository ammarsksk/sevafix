from common.rules import BLOCKED_MISSING_EVIDENCE, FAIL, NEEDS_REVIEW, PASS, compare, evaluate_rule, readiness


def test_income_boundary_and_over_cap():
    assert compare(450000, "LTE", 450000)[0] == PASS
    assert compare("₹4,50,001", "LTE", 450000)[0] == FAIL


def test_name_matching_is_conservative():
    assert compare("Shri Aditi Sharma", "NAME_SIMILAR", "ADITI SHARMA")[0] == PASS
    assert compare("Aditi Sharma", "NAME_SIMILAR", "Aditee Sharma")[0] == NEEDS_REVIEW
    assert compare("Aditi Sharma", "NAME_SIMILAR", "Rahul Singh")[0] == FAIL


def test_rule_requires_document_evidence():
    rule = {"assert": {"field": "student.income", "op": "LTE", "value": 450000}, "requiredEvidence": ["INCOME_CERTIFICATE"]}
    result = evaluate_rule(rule, {"student": {"income": 200000}}, set())
    assert result["status"] == BLOCKED_MISSING_EVIDENCE


def test_readiness_only_when_all_blocking_checks_pass():
    result = readiness([{"status": PASS, "severity": "BLOCKING"}, {"status": FAIL, "severity": "ADVISORY"}])
    assert result["ready"] is True
    assert result["label"] == "READY_WITH_SEVAFIX_CHECKS"

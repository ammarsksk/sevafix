import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "seed_verified.py"
SPEC = importlib.util.spec_from_file_location("seed_verified", SCRIPT)
seed_verified = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(seed_verified)


def test_verified_policy_package_is_internally_consistent():
    manifest, policy_text = seed_verified.load_package(
        ROOT / "data" / "pm-usp-csss-2026-27.3"
    )
    assert manifest["scheme"]["schemeId"] == "pm-usp-csss"
    assert len(manifest["rules"]) == 17
    income_match = next(rule for rule in manifest["rules"] if rule["ruleId"] == "fresh-income-certificate-match")
    assert income_match["assert"]["otherField"] == "document.annualIncomeINR"
    assert len(manifest["sources"]) == 5
    assert "deadline" not in {rule["ruleId"] for rule in manifest["rules"]}
    assert "CONFLICT_REQUIRES_HUMAN_REVIEW" in str(manifest["scheme"]["liveWindow"])
    assert "official authority" in policy_text.casefold()


def test_fresh_and_renewal_demo_cases_cover_all_form_conditions():
    manifest, _ = seed_verified.load_package(
        ROOT / "data" / "pm-usp-csss-2026-27.3"
    )
    cases = manifest["demoCases"]
    assert cases["freshEligible"]["application.type"] == "FRESH"
    assert cases["renewalEligible"]["application.type"] == "RENEWAL"
    condition_values = {
        rule["appliesWhen"]["value"]
        for rule in manifest["rules"]
        if rule.get("appliesWhen")
    }
    assert condition_values == {"FRESH", "RENEWAL"}


def test_each_application_checklist_exposes_its_required_rule_evidence():
    manifest, _ = seed_verified.load_package(
        ROOT / "data" / "pm-usp-csss-2026-27.3"
    )
    scheme = manifest["scheme"]
    checklist = {
        application_type: {item["documentType"] for item in items}
        for application_type, items in scheme["documentChecklist"].items()
    }
    for rule in manifest["rules"]:
        condition = rule.get("appliesWhen")
        application_types = set(scheme["supportedApplicationTypes"])
        if condition and condition.get("field") == "application.type" and condition.get("op") == "EQ":
            application_types = {condition["value"]}
        for application_type in application_types:
            assert set(rule.get("requiredEvidence", [])).issubset(checklist[application_type]), rule["ruleId"]

"""Source-grounded, conservative pre-check packages for the public scheme catalog.

These packages intentionally check only facts a user can safely self-declare or
support with a document. They do not claim to replace the competent authority's
database/list verification or final eligibility decision.
"""
from __future__ import annotations

from typing import Any


DISCLAIMER = (
    "SevaFix performs a document and self-declaration pre-check only. The official "
    "authority decides eligibility, selection, submission status, and payment."
)


def field(key: str, label: str, kind: str = "boolean", **extra: Any) -> dict[str, Any]:
    return {"key": key, "label": label, "type": kind, "required": True, **extra}


def document(document_type: str, label: str, *, required: bool = True) -> dict[str, Any]:
    return {"documentType": document_type, "label": label, "required": required}


def rule(rule_id: str, title: str, key: str, op: str, value: Any, source_id: str,
         *, evidence: list[str] | None = None, severity: str = "BLOCKING") -> dict[str, Any]:
    result = {
        "ruleId": rule_id,
        "title": title,
        "severity": severity,
        "assert": {"field": key, "op": op, "value": value},
        "sourceRefs": [source_id],
        "messageKey": rule_id.replace("-", "_"),
    }
    if evidence:
        result["requiredEvidence"] = evidence
    return result


def package(*, scheme_id: str, name: str, short_name: str, authority: str, portal: str,
            source_url: str, source_title: str, sections: list[dict[str, Any]],
            documents: list[dict[str, Any]], rules: list[dict[str, Any]],
            notes: list[str], policy_version_id: str | None = None) -> dict[str, Any]:
    source_id = f"{scheme_id}-official-guidance"
    return {
        "schemeId": scheme_id,
        "name": name,
        "shortName": short_name,
        "authority": authority,
        "officialPortalUrl": portal,
        "status": "ACTIVE",
        "applicationReady": True,
        "catalogStatus": "READY",
        "supportedApplicationTypes": ["NEW"],
        "disclaimer": DISCLAIMER,
        "formSchema": {"version": "1.0.0", "sections": sections},
        "documentChecklist": {"NEW": documents},
        "policyVersionId": policy_version_id or f"{scheme_id}-precheck-2026.1",
        "source": {
            "sourceId": source_id,
            "title": source_title,
            "url": source_url,
            "authority": authority,
            "sourceType": "OFFICIAL_GOVERNMENT_SOURCE",
        },
        "rules": rules,
        "notes": notes,
    }


def section(section_id: str, title: str, fields: list[dict[str, Any]]) -> dict[str, Any]:
    return {"id": section_id, "title": title, "fields": fields}


COMMON_IDENTITY = [
    field("applicant.primaryName", "Applicant name as on official identity evidence", "text"),
    field("applicant.state", "State or Union Territory", "text"),
]


SCHEME_PACKAGES: list[dict[str, Any]] = []


def _add(raw: dict[str, Any]) -> None:
    source_id = f"{raw['scheme_id']}-official-guidance"
    raw["rules"] = [
        rule(item[0], item[1], item[2], item[3], item[4], source_id,
             evidence=item[5] if len(item) > 5 else None,
             severity=item[6] if len(item) > 6 else "BLOCKING")
        for item in raw["rules"]
    ]
    SCHEME_PACKAGES.append(package(**raw))


_add({
    "scheme_id": "pm-kisan",
    "name": "Pradhan Mantri Kisan Samman Nidhi",
    "short_name": "PM-KISAN",
    "authority": "Department of Agriculture and Farmers Welfare, Ministry of Agriculture and Farmers Welfare",
    "portal": "https://pmkisan.gov.in/",
    "source_url": "https://pmkisan.gov.in/Documents/RevisedPM-KISANOperationalGuidelines%28English%29.pdf",
    "source_title": "PM-KISAN revised operational guidelines",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY),
        section("land", "Landholding family", [
            field("farmer.familyOwnsCultivableLand", "Family owns cultivable land recorded by the State/UT"),
            field("farmer.isInstitutionalLandholder", "Applicant is an institutional landholder"),
            field("farmer.hasExcludedFamilyMember", "A family member falls in an official exclusion category"),
            field("farmer.ekycComplete", "PM-KISAN eKYC is complete"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity evidence"), document("LAND_RECORD", "State/UT land record"), document("BANK_PROOF", "Bank/DBT evidence")],
    "rules": [
        ("cultivable-land", "Family must own cultivable land in State/UT records", "farmer.familyOwnsCultivableLand", "EQ", True, ["LAND_RECORD"]),
        ("not-institutional", "Institutional landholders are excluded", "farmer.isInstitutionalLandholder", "EQ", False),
        ("no-excluded-member", "Family must not fall in an official exclusion category", "farmer.hasExcludedFamilyMember", "EQ", False),
        ("ekyc-ready", "eKYC should be complete", "farmer.ekycComplete", "EQ", True, None, "ADVISORY"),
    ],
    "notes": ["Benefits are for landholding farmer families with cultivable land, subject to official exclusions.", "The State/UT identifies beneficiaries and official records control the decision."],
})

_add({
    "scheme_id": "ab-pmjay",
    "name": "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
    "short_name": "AB PM-JAY",
    "authority": "National Health Authority, Ministry of Health and Family Welfare",
    "portal": "https://pmjay.gov.in/",
    "source_url": "https://beneficiary.nha.gov.in/",
    "source_title": "National Health Authority PM-JAY beneficiary portal",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY),
        section("beneficiary", "Official beneficiary check", [
            field("health.householdFoundInOfficialList", "Household was found in the official PM-JAY beneficiary search"),
            field("health.identityDetailsMatch", "Name and household details match the official record"),
            field("health.hasAyushmanCard", "Applicant already has an Ayushman card"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Government identity evidence"), document("HOUSEHOLD_PROOF", "Ration card or household evidence"), document("BENEFICIARY_RECORD", "Official eligibility/card search result", required=False)],
    "rules": [
        ("official-list-match", "Eligibility must be confirmed in the official beneficiary system", "health.householdFoundInOfficialList", "EQ", True, None, "ADVISORY"),
        ("identity-match", "Identity details should match the official record", "health.identityDetailsMatch", "EQ", True, ["IDENTITY_PROOF"]),
    ],
    "notes": ["PM-JAY entitlement is determined through the official beneficiary database and applicable State/UT coverage.", "SevaFix cannot add a household to the official list."],
})

_add({
    "scheme_id": "pmuy",
    "name": "Pradhan Mantri Ujjwala Yojana",
    "short_name": "PMUY",
    "authority": "Ministry of Petroleum and Natural Gas",
    "portal": "https://www.pmuy.gov.in/",
    "source_url": "https://www.pmuy.gov.in/faq.html",
    "source_title": "PMUY official frequently asked questions",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY + [field("applicant.age", "Applicant age", "integer", minimum=0)]),
        section("household", "Household", [
            field("lpg.isAdultWoman", "Applicant is an adult woman"),
            field("lpg.noExistingConnection", "No member of the household has an LPG connection"),
            field("lpg.poorHouseholdDeclaration", "Applicant can provide the prescribed poor-household declaration"),
        ]),
    ],
    "documents": [document("KYC_FORM", "Completed KYC/application form"), document("IDENTITY_PROOF", "Identity evidence"), document("RATION_CARD", "Ration card or State family-composition document"), document("BANK_PROOF", "Bank account evidence"), document("ADDRESS_PROOF", "Address evidence, if required")],
    "rules": [
        ("adult-woman", "Applicant must be an adult woman", "lpg.isAdultWoman", "EQ", True, ["IDENTITY_PROOF"]),
        ("minimum-age", "Applicant must be at least 18 years old", "applicant.age", "GTE", 18, ["IDENTITY_PROOF"]),
        ("no-household-lpg", "Household must not already have an LPG connection", "lpg.noExistingConnection", "EQ", True),
        ("poor-household-declaration", "Prescribed household declaration must be available", "lpg.poorHouseholdDeclaration", "EQ", True),
    ],
    "notes": ["The application is for an adult woman from an eligible poor household without an existing household LPG connection.", "The oil marketing company performs final KYC and de-duplication."],
})

_add({
    "scheme_id": "pmay-u-2",
    "name": "Pradhan Mantri Awas Yojana - Urban 2.0",
    "short_name": "PMAY-U 2.0",
    "authority": "Ministry of Housing and Urban Affairs",
    "portal": "https://pmaymis.gov.in/PMAYMIS2_2024/PmayDefault.aspx",
    "source_url": "https://pmay-urban.gov.in/uploads/guidelines/Operational-Guidelines-of-PMAY-U-2.pdf",
    "source_title": "PMAY-U 2.0 operational guidelines",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY),
        section("housing", "Housing and income", [
            field("housing.livesInUrbanArea", "Family lives in an urban area"),
            field("housing.familyAnnualIncomeINR", "Annual household income (INR)", "integer", minimum=0),
            field("housing.ownsPuccaHouse", "Family owns a pucca house anywhere in India"),
            field("housing.receivedGovernmentHouseLast20Years", "Family received a government housing allotment in the last 20 years"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity evidence"), document("INCOME_CERTIFICATE", "Household income evidence"), document("ADDRESS_PROOF", "Present/permanent address evidence"), document("HOUSING_DECLARATION", "No-pucca-house and prior-benefit declaration")],
    "rules": [
        ("urban-family", "Family must live in an urban area", "housing.livesInUrbanArea", "EQ", True, ["ADDRESS_PROOF"]),
        ("income-cap", "EWS/LIG/MIG household income must not exceed INR 9 lakh", "housing.familyAnnualIncomeINR", "LTE", 900000, ["INCOME_CERTIFICATE"]),
        ("no-pucca-house", "Family must not own a pucca house anywhere in India", "housing.ownsPuccaHouse", "EQ", False, ["HOUSING_DECLARATION"]),
        ("no-recent-housing-benefit", "Family must not have received a government housing allotment in the last 20 years", "housing.receivedGovernmentHouseLast20Years", "EQ", False, ["HOUSING_DECLARATION"]),
    ],
    "notes": ["Urban EWS/LIG/MIG families without a pucca house may be considered, subject to the selected vertical and verification.", "States/UTs and ULBs verify beneficiaries and may apply permitted local criteria."],
})

_add({
    "scheme_id": "pmay-g",
    "name": "Pradhan Mantri Awaas Yojana - Gramin",
    "short_name": "PMAY-G",
    "authority": "Department of Rural Development, Ministry of Rural Development",
    "portal": "https://pmayg.nic.in/",
    "source_url": "https://pmayg.nic.in/netiayHome/home.aspx",
    "source_title": "PMAY-G official portal",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY),
        section("rural", "Rural housing record", [
            field("rural.livesInRuralArea", "Household lives in a rural area"),
            field("rural.houselessOrKutcha", "Household is houseless or lives in a kutcha/dilapidated house"),
            field("rural.presentInOfficialWaitList", "Household appears in the official permanent wait list/Awaas+ record"),
            field("rural.gramSabhaVerified", "Gram Sabha verification is complete"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity evidence"), document("ADDRESS_PROOF", "Rural residence evidence"), document("WAITLIST_RECORD", "Official wait-list/Awaas+ record", required=False), document("BANK_PROOF", "Bank/DBT evidence")],
    "rules": [
        ("rural-resident", "Household must be in a rural jurisdiction", "rural.livesInRuralArea", "EQ", True, ["ADDRESS_PROOF"]),
        ("housing-need", "Household should be houseless or in kutcha/dilapidated housing", "rural.houselessOrKutcha", "EQ", True),
        ("official-list", "Selection depends on the official wait list/Awaas+ record", "rural.presentInOfficialWaitList", "EQ", True, None, "ADVISORY"),
        ("gram-sabha", "Gram Sabha verification should be complete", "rural.gramSabhaVerified", "EQ", True, None, "ADVISORY"),
    ],
    "notes": ["PMAY-G selection is list-based and validated through the Gram Sabha and official rural housing systems.", "SevaFix cannot place a household on the official permanent wait list."],
})

_add({
    "scheme_id": "pm-svanidhi",
    "policy_version_id": "pm-svanidhi-precheck-2026.2",
    "name": "Prime Minister Street Vendor's AtmaNirbhar Nidhi",
    "short_name": "PM SVANidhi",
    "authority": "Ministry of Housing and Urban Affairs",
    "portal": "https://pmsvanidhi.mohua.gov.in/",
    "source_url": "https://pmsvanidhi.mohua.gov.in/",
    "source_title": "PM SVANidhi official portal",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY),
        section("vendor", "Street-vending record", [
            field("vendor.isStreetVendor", "Applicant works as a street vendor"),
            field("vendor.operatesInUrbanArea", "Vending activity is in an urban/local-body area"),
            field("vendor.hasCertificateOrRecommendation", "Applicant has a Certificate/ID or a ULB/TVC Letter of Recommendation"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity evidence"), document("VENDING_CERTIFICATE", "Certificate of Vending/ID card or Letter of Recommendation"), document("BANK_PROOF", "Bank account evidence")],
    "rules": [
        ("street-vendor", "Applicant must be a street vendor", "vendor.isStreetVendor", "EQ", True),
        ("urban-vending", "Vending activity must be linked to an urban local body", "vendor.operatesInUrbanArea", "EQ", True),
        ("vendor-record", "Certificate/ID or Letter of Recommendation must be available", "vendor.hasCertificateOrRecommendation", "EQ", True, ["VENDING_CERTIFICATE"], "ADVISORY"),
    ],
    "notes": ["Vendor identification and recommendation are handled by the relevant ULB/Town Vending Committee.", "Applicants without a vending certificate may need the official Letter of Recommendation route."],
})

_add({
    "scheme_id": "pmmvy",
    "name": "Pradhan Mantri Matru Vandana Yojana",
    "short_name": "PMMVY",
    "authority": "Ministry of Women and Child Development",
    "portal": "https://pmmvy.wcd.gov.in/",
    "source_url": "https://pmmvy.wcd.gov.in/",
    "source_title": "PMMVY official portal",
    "sections": [
        section("applicant", "Beneficiary", COMMON_IDENTITY),
        section("maternity", "Pregnancy and child", [
            field("maternity.isPregnantOrLactating", "Applicant is pregnant or lactating"),
            field("maternity.benefitCase", "Benefit case", "select", options=["FIRST_CHILD", "SECOND_CHILD_GIRL"]),
            field("maternity.isRegularGovernmentEmployee", "Applicant is a regular Central/State Government or PSU employee"),
            field("maternity.receivesSimilarPaidMaternityBenefit", "Applicant receives a similar paid maternity benefit under law"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Beneficiary identity evidence"), document("MOTHER_CHILD_RECORD", "MCP/RCHI or pregnancy registration record"), document("CHILD_BIRTH_RECORD", "Child birth/registration evidence when applicable"), document("BANK_PROOF", "Beneficiary bank/DBT evidence")],
    "rules": [
        ("pregnant-lactating", "Applicant must be pregnant or lactating", "maternity.isPregnantOrLactating", "EQ", True, ["MOTHER_CHILD_RECORD"]),
        ("supported-case", "Case must be first child or second child where the child is a girl", "maternity.benefitCase", "IN", ["FIRST_CHILD", "SECOND_CHILD_GIRL"]),
        ("not-government-employee", "Regular government/PSU employees are excluded", "maternity.isRegularGovernmentEmployee", "EQ", False),
        ("no-similar-benefit", "Applicant must not already receive a similar paid maternity benefit", "maternity.receivesSimilarPaidMaternityBenefit", "EQ", False),
    ],
    "notes": ["PMMVY covers prescribed maternity cases and instalments, subject to health-registration and official verification.", "State/UT implementation details and required milestones must be confirmed on the official portal."],
})

_add({
    "scheme_id": "nsap",
    "name": "National Social Assistance Programme",
    "short_name": "NSAP",
    "authority": "Department of Rural Development, Ministry of Rural Development",
    "portal": "https://nsap.nic.in/",
    "source_url": "https://nsap.nic.in/circular.do?method=aboutus",
    "source_title": "NSAP official programme information",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY + [field("applicant.age", "Applicant age", "integer", minimum=0)]),
        section("assistance", "Assistance category", [
            field("nsap.component", "NSAP component", "select", options=["OLD_AGE", "WIDOW", "DISABILITY", "FAMILY_BENEFIT", "ANNAPURNA"]),
            field("nsap.bplOrStateEligible", "Household meets the applicable BPL/State eligibility record"),
            field("nsap.localBodyVerified", "Local body/State verification is complete"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity and age evidence"), document("ELIGIBILITY_RECORD", "BPL/State eligibility evidence"), document("CATEGORY_EVIDENCE", "Component-specific evidence (widowhood, disability, death, or age)"), document("BANK_PROOF", "Bank/post-office payment evidence")],
    "rules": [
        ("component-selected", "An NSAP component must be selected", "nsap.component", "IN", ["OLD_AGE", "WIDOW", "DISABILITY", "FAMILY_BENEFIT", "ANNAPURNA"]),
        ("income-record", "Applicable BPL/State eligibility should be confirmed", "nsap.bplOrStateEligible", "EQ", True, ["ELIGIBILITY_RECORD"]),
        ("local-verification", "Local body/State verification should be complete", "nsap.localBodyVerified", "EQ", True, None, "ADVISORY"),
    ],
    "notes": ["NSAP is an umbrella programme; eligibility and evidence depend on the selected component and State/UT implementation.", "The local body and State/UT system make the operative decision."],
})

_add({
    "scheme_id": "pm-vishwakarma",
    "name": "PM Vishwakarma",
    "short_name": "PM Vishwakarma",
    "authority": "Ministry of Micro, Small and Medium Enterprises",
    "portal": "https://pmvishwakarma.gov.in/",
    "source_url": "https://pmvishwakarma.gov.in/Home/HowToRegister",
    "source_title": "PM Vishwakarma official registration guidance",
    "sections": [
        section("applicant", "Applicant", COMMON_IDENTITY + [field("applicant.age", "Applicant age", "integer", minimum=0)]),
        section("artisan", "Trade and household", [
            field("artisan.trade", "Traditional trade", "select", options=["CARPENTER", "BOAT_MAKER", "ARMOURER", "BLACKSMITH", "HAMMER_TOOLKIT_MAKER", "LOCKSMITH", "GOLDSMITH", "POTTER", "SCULPTOR", "COBBLER", "MASON", "BASKET_MAT_BROOM_MAKER", "DOLL_TOY_MAKER", "BARBER", "GARLAND_MAKER", "WASHERMAN", "TAILOR", "FISHING_NET_MAKER"]),
            field("artisan.selfEmployedHandsOn", "Applicant is self-employed and works with hands/tools in the selected trade"),
            field("artisan.onlyFamilyMemberApplying", "No other member of the same family is applying/registered"),
            field("artisan.governmentEmployeeFamily", "Applicant or spouse is a government employee"),
        ]),
    ],
    "documents": [document("IDENTITY_PROOF", "Identity and age evidence"), document("FAMILY_PROOF", "Ration card/family evidence"), document("BANK_PROOF", "Bank account evidence"), document("TRADE_VERIFICATION", "Local trade verification/registration evidence", required=False)],
    "rules": [
        ("adult-artisan", "Applicant must be at least 18 years old", "applicant.age", "GTE", 18, ["IDENTITY_PROOF"]),
        ("recognized-trade", "Trade must be one of the notified traditional trades", "artisan.trade", "IN", ["CARPENTER", "BOAT_MAKER", "ARMOURER", "BLACKSMITH", "HAMMER_TOOLKIT_MAKER", "LOCKSMITH", "GOLDSMITH", "POTTER", "SCULPTOR", "COBBLER", "MASON", "BASKET_MAT_BROOM_MAKER", "DOLL_TOY_MAKER", "BARBER", "GARLAND_MAKER", "WASHERMAN", "TAILOR", "FISHING_NET_MAKER"]),
        ("hands-on-artisan", "Applicant must be a self-employed hands-on artisan/craftsperson", "artisan.selfEmployedHandsOn", "EQ", True),
        ("one-family-member", "Only one member per family may receive scheme registration", "artisan.onlyFamilyMemberApplying", "EQ", True, ["FAMILY_PROOF"]),
        ("no-government-employee-family", "Government employees and their spouses are excluded", "artisan.governmentEmployeeFamily", "EQ", False),
    ],
    "notes": ["Registration is for eligible self-employed artisans/craftspeople in the notified trades.", "Gram Panchayat/ULB and subsequent official verification stages control approval."],
})


PACKAGES_BY_ID = {item["schemeId"]: item for item in SCHEME_PACKAGES}

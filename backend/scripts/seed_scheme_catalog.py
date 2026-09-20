from __future__ import annotations

import argparse
from datetime import UTC, datetime

import boto3


CATALOG = [
    {
        "schemeId": "pm-kisan",
        "name": "Pradhan Mantri Kisan Samman Nidhi",
        "shortName": "PM-KISAN",
        "authority": "Department of Agriculture and Farmers Welfare, Ministry of Agriculture and Farmers Welfare",
        "officialPortalUrl": "https://pmkisan.gov.in/",
    },
    {
        "schemeId": "ab-pmjay",
        "name": "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
        "shortName": "AB PM-JAY",
        "authority": "National Health Authority, Ministry of Health and Family Welfare",
        "officialPortalUrl": "https://pmjay.gov.in/",
    },
    {
        "schemeId": "pmuy",
        "name": "Pradhan Mantri Ujjwala Yojana",
        "shortName": "PMUY",
        "authority": "Ministry of Petroleum and Natural Gas",
        "officialPortalUrl": "https://www.pmuy.gov.in/",
    },
    {
        "schemeId": "pmay-u-2",
        "name": "Pradhan Mantri Awas Yojana - Urban 2.0",
        "shortName": "PMAY-U 2.0",
        "authority": "Ministry of Housing and Urban Affairs",
        "officialPortalUrl": "https://pmaymis.gov.in/PMAYMIS2_2024/PmayDefault.aspx",
    },
    {
        "schemeId": "pmay-g",
        "name": "Pradhan Mantri Awaas Yojana - Gramin",
        "shortName": "PMAY-G",
        "authority": "Department of Rural Development, Ministry of Rural Development",
        "officialPortalUrl": "https://pmayg.nic.in/",
    },
    {
        "schemeId": "pm-svanidhi",
        "name": "Prime Minister Street Vendor's AtmaNirbhar Nidhi",
        "shortName": "PM SVANidhi",
        "authority": "Ministry of Housing and Urban Affairs",
        "officialPortalUrl": "https://pmsvanidhi.mohua.gov.in/",
    },
    {
        "schemeId": "pmmvy",
        "name": "Pradhan Mantri Matru Vandana Yojana",
        "shortName": "PMMVY",
        "authority": "Ministry of Women and Child Development",
        "officialPortalUrl": "https://pmmvy.wcd.gov.in/",
    },
    {
        "schemeId": "nsap",
        "name": "National Social Assistance Programme",
        "shortName": "NSAP",
        "authority": "Department of Rural Development, Ministry of Rural Development",
        "officialPortalUrl": "https://nsap.nic.in/",
    },
    {
        "schemeId": "pm-vishwakarma",
        "name": "PM Vishwakarma",
        "shortName": "PM Vishwakarma",
        "authority": "Ministry of Micro, Small and Medium Enterprises",
        "officialPortalUrl": "https://pmvishwakarma.gov.in/",
    },
]

REPLACED_SCHOLARSHIP_IDS = (
    "top-class-sc-students",
    "top-class-st-students",
    "post-matric-sc",
    "post-matric-obc-ebc-dnt",
    "pre-matric-sc",
    "nmmss",
    "national-overseas-scholarship",
    "aicte-pragati",
    "aicte-saksham",
)

DATA_GOV_SOURCES = (
    {
        "sourceId": "pm-kisan-data-gov-catalog",
        "schemeId": "pm-kisan",
        "title": "PM-KISAN catalog API on data.gov.in",
        "sourceKind": "DATA_GOV_API",
        "url": (
            "https://api.data.gov.in/resource/db14e0fa-8299-41b1-a42b-e301668da6e7"
            "?format=json&offset=0&limit=10"
        ),
    },
    {
        "sourceId": "pmuy-data-gov-catalog",
        "schemeId": "pmuy",
        "title": "PMUY and DBTL catalog API on data.gov.in",
        "sourceKind": "DATA_GOV_API",
        "url": (
            "https://api.data.gov.in/resource/4fa01599-b4ca-4f24-ac4b-6808368280bd"
            "?format=json&offset=0&limit=10"
        ),
    },
    {
        "sourceId": "pmay-g-data-gov-catalog",
        "schemeId": "pmay-g",
        "title": "PMAY-G catalog API on data.gov.in",
        "sourceKind": "DATA_GOV_API",
        "url": (
            "https://api.data.gov.in/resource/25e24123-1ace-44fa-81cb-6d5927fd57ac"
            "?format=json&offset=0&limit=10"
        ),
    },
    {
        "sourceId": "nsap-data-gov-catalog",
        "schemeId": "nsap",
        "title": "NSAP beneficiaries catalog API on data.gov.in",
        "sourceKind": "DATA_GOV_API",
        "url": (
            "https://api.data.gov.in/resource/27a2a56e-0a74-4877-9690-9ce6874830a1"
            "?format=json&offset=0&limit=10"
        ),
    },
)

OFFICIAL_SOURCE_URL_OVERRIDES = {
    "ab-pmjay": (
        "https://www.india.gov.in/category/health-wellness/subcategory/health-resources/details/"
        "ayushman-bharat-scheme"
    ),
    "pmay-g": (
        "https://www.india.gov.in/category/housing-local-services/subcategory/ews-rural-housing/details/"
        "website-of-pradhan-mantri-awaas-yojana-gramin"
    ),
    "nsap": (
        "https://www.india.gov.in/category/agriculture-rural-environment/subcategory/rural-ecosystem/details/"
        "website-of-national-social-assistance-programme-nsap"
    ),
}

OFFICIAL_WEB_SOURCES = tuple(
    {
        "sourceId": f"{scheme['schemeId']}-official-portal",
        "schemeId": scheme["schemeId"],
        "title": f"{scheme['shortName']} official government source",
        "sourceKind": "WEB",
        "url": OFFICIAL_SOURCE_URL_OVERRIDES.get(scheme["schemeId"], scheme["officialPortalUrl"]),
    }
    for scheme in CATALOG
)

RULE_DOCUMENT_SOURCES = (
    {
        "sourceId": "pm-kisan-operational-guidelines",
        "schemeId": "pm-kisan",
        "title": "PM-KISAN revised operational guidelines",
        "sourceKind": "WEB",
        "url": "https://pmkisan.gov.in/Documents/RevisedPM-KISANOperationalGuidelines%28English%29.pdf",
    },
)

MONITORED_SOURCES = DATA_GOV_SOURCES + OFFICIAL_WEB_SOURCES + RULE_DOCUMENT_SOURCES


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the discoverable government scheme catalog.")
    parser.add_argument("--stack", default="sevafix-dev")
    parser.add_argument("--profile", default="sevafix-deploy")
    parser.add_argument("--region", default="ap-south-1")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = {
        item["OutputKey"]: item["OutputValue"]
        for item in session.client("cloudformation").describe_stacks(StackName=args.stack)["Stacks"][0]["Outputs"]
    }
    table = session.resource("dynamodb").Table(outputs["TableName"])
    now = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    for scheme_id in REPLACED_SCHOLARSHIP_IDS:
        table.delete_item(Key={"PK": f"SCHEME#{scheme_id}", "SK": "META"})
        table.delete_item(Key={"PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme_id}"})

    for scheme in CATALOG:
        existing = table.get_item(
            Key={"PK": f"SCHEME#{scheme['schemeId']}", "SK": "META"}, ConsistentRead=True
        ).get("Item")
        item = {
            "PK": f"SCHEME#{scheme['schemeId']}",
            "SK": "META",
            "entityType": "Scheme",
            **scheme,
            "status": "ACTIVE",
            "applicationReady": False,
            "catalogStatus": "POLICY_ONBOARDING",
            "disclaimer": "SevaFix is preparing a reviewed policy package for this scheme. Check the official portal for current eligibility and application instructions.",
            "updatedAt": now,
        }
        # Catalog refreshes must never undo an already published application
        # package. The activation loader owns these versioned workflow fields.
        if existing and existing.get("applicationReady") is True and existing.get("activePolicyVersionId"):
            for key in (
                "applicationReady", "catalogStatus", "disclaimer", "supportedApplicationTypes",
                "formSchema", "documentChecklist", "activePolicyVersionId", "policyPackageHash",
            ):
                if key in existing:
                    item[key] = existing[key]
        catalog_item = {**item, "PK": "CATALOG#SCHEMES", "SK": f"SCHEME#{scheme['schemeId']}"}
        table.put_item(Item=item)
        table.put_item(Item=catalog_item)

    for source in MONITORED_SOURCES:
        table.update_item(
            Key={"PK": "SOURCES#REGISTRY", "SK": f"SOURCE#{source['sourceId']}"},
            UpdateExpression=(
                "SET entityType=:entity, schemeId=:scheme, sourceId=:source, "
                "title=:title, #url=:url, sourceKind=:kind, enabled=:enabled, "
                "registeredAt=if_not_exists(registeredAt,:now)"
            ),
            ExpressionAttributeNames={"#url": "url"},
            ExpressionAttributeValues={
                ":entity": "OfficialSource",
                ":scheme": source["schemeId"],
                ":source": source["sourceId"],
                ":title": source["title"],
                ":url": source["url"],
                ":kind": source["sourceKind"],
                ":enabled": True,
                ":now": now,
            },
        )

    pm_key = {"PK": "CATALOG#SCHEMES", "SK": "SCHEME#pm-usp-csss"}
    table.update_item(
        Key=pm_key,
        UpdateExpression="SET applicationReady=:ready, catalogStatus=:status, updatedAt=:now",
        ExpressionAttributeValues={":ready": True, ":status": "READY", ":now": now},
    )
    print(f"Seeded {len(CATALOG) + 1} government scheme catalog entries without downgrading published workflows.")


if __name__ == "__main__":
    main()

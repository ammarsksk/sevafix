from scripts.seed_scheme_catalog import (
    CATALOG,
    DATA_GOV_SOURCES,
    MONITORED_SOURCES,
    OFFICIAL_SOURCE_URL_OVERRIDES,
    REPLACED_SCHOLARSHIP_IDS,
)


def test_catalog_has_nine_discovery_schemes_plus_pm_usp() -> None:
    assert len(CATALOG) == 9
    assert len({scheme["schemeId"] for scheme in CATALOG}) == 9
    assert len(CATALOG) + 1 == 10


def test_catalog_replaces_every_previous_scholarship() -> None:
    new_scheme_ids = {scheme["schemeId"] for scheme in CATALOG}
    assert new_scheme_ids.isdisjoint(REPLACED_SCHOLARSHIP_IDS)
    assert len(REPLACED_SCHOLARSHIP_IDS) == 9


def test_every_discovery_scheme_links_to_an_official_portal() -> None:
    for scheme in CATALOG:
        assert scheme["officialPortalUrl"].startswith("https://")
        assert scheme["authority"]


def test_data_gov_sources_are_verified_catalog_endpoints_without_secrets() -> None:
    assert {source["schemeId"] for source in DATA_GOV_SOURCES} == {"pm-kisan", "pmuy", "pmay-g", "nsap"}
    assert len({source["sourceId"] for source in DATA_GOV_SOURCES}) == 4
    for source in DATA_GOV_SOURCES:
        assert source["sourceKind"] == "DATA_GOV_API"
        assert source["url"].startswith("https://api.data.gov.in/resource/")
        assert "api-key" not in source["url"]


def test_every_discovery_scheme_has_an_official_web_source() -> None:
    scheme_ids = {scheme["schemeId"] for scheme in CATALOG}
    official_source_ids = {
        source["schemeId"] for source in MONITORED_SOURCES if source["sourceId"].endswith("-official-portal")
    }
    assert official_source_ids == scheme_ids
    assert len({source["sourceId"] for source in MONITORED_SOURCES}) == len(MONITORED_SOURCES)
    assert set(OFFICIAL_SOURCE_URL_OVERRIDES) == {"ab-pmjay", "pmay-g", "nsap"}
    assert all(url.startswith("https://") for url in OFFICIAL_SOURCE_URL_OVERRIDES.values())

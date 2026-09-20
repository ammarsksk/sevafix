from common.scheme_packages import SCHEME_PACKAGES


def test_all_catalog_packages_are_application_ready_and_versioned():
    assert len(SCHEME_PACKAGES) == 9
    assert len({item["schemeId"] for item in SCHEME_PACKAGES}) == 9
    for item in SCHEME_PACKAGES:
        assert item["status"] == "ACTIVE"
        assert item["applicationReady"] is True
        assert item["catalogStatus"] == "READY"
        assert item["policyVersionId"].startswith(item["schemeId"])
        assert item["formSchema"]["sections"]
        assert item["documentChecklist"]["NEW"]
        assert item["rules"]
        assert item["source"]["url"].startswith("https://")


def test_rules_reference_declared_fields_and_documents():
    for item in SCHEME_PACKAGES:
        fields = {
            field["key"]
            for section in item["formSchema"]["sections"]
            for field in section["fields"]
        }
        documents = {document["documentType"] for document in item["documentChecklist"]["NEW"]}
        for rule in item["rules"]:
            assert rule["assert"]["field"] in fields
            assert set(rule.get("requiredEvidence", [])).issubset(documents)
            assert rule["sourceRefs"] == [item["source"]["sourceId"]]

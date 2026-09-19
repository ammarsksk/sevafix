from __future__ import annotations

import api.app as api_app


class RecordingStore:
    def __init__(self):
        self.transactions = []
        self.updates = []
        self.events = []

    def get(self, pk, sk, consistent=False):
        if pk == "SCHEME#scheme-1" and sk == "META":
            return {"schemeId": "scheme-1", "status": "ACTIVE", "activePolicyVersionId": "policy-v1"}
        return None

    def transact(self, actions):
        self.transactions.extend(actions)

    def update(self, pk, sk, expression, values, **kwargs):
        self.updates.append((pk, sk, expression, values, kwargs))
        return {"appId": "app-test", "schemeId": "scheme-1", "sourceApplication": values.get(":source")}

    def append_event(self, app_id, event_type, actor, payload, **kwargs):
        self.events.append((app_id, event_type, actor, payload))


def test_create_application_records_the_selected_journey(monkeypatch):
    store = RecordingStore()
    monkeypatch.setattr(api_app, "new_id", lambda prefix: f"{prefix}-test")
    monkeypatch.setattr(api_app, "utc_now", lambda: "2026-09-19T00:00:00Z")

    result = api_app._create_application(
        store,
        "citizen-1",
        {"schemeId": "scheme-1", "journeyType": "GRIEVANCE"},
    )

    assert result["journeyType"] == "GRIEVANCE"
    summary = store.transactions[1]["Put"]["Item"]
    assert summary["journeyType"] == "GRIEVANCE"


def test_external_grievance_freezes_a_snapshot_and_never_stores_raw_official_id(monkeypatch):
    store = RecordingStore()
    frozen = []
    monkeypatch.setattr(
        api_app,
        "_create_application",
        lambda *_: {"appId": "app-test", "createdAt": "2026-09-19T00:00:00Z"},
    )
    monkeypatch.setattr(api_app, "_freeze_version", lambda *args: frozen.append(args[1]))
    monkeypatch.setattr(api_app, "utc_now", lambda: "2026-09-19T00:01:00Z")

    api_app._open_grievance(
        store,
        "citizen-1",
        {
            "schemeId": "scheme-1",
            "sourceApplication": "EXTERNAL",
            "officialApplicationId": "NSP-RAW-SECRET-1234",
            "rejectionReason": "The income certificate did not match.",
        },
    )

    assert frozen == ["app-test"]
    assert "NSP-RAW-SECRET-1234" not in repr(store.updates)
    assert any(event[1] == "EXTERNAL_GRIEVANCE_IMPORTED" for event in store.events)

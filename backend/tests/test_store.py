from common.store import Store


class Client:
    def transact_write_items(self, **kwargs):
        self.kwargs = kwargs


class Meta:
    def __init__(self):
        self.client = Client()


class Table:
    name = "test-table"

    def __init__(self):
        self.meta = Meta()


class Resource:
    def __init__(self):
        self.value = Table()

    def Table(self, name):
        return self.value


def test_transactions_use_native_values_for_resource_client():
    store = Store("test-table", Resource())
    store.transact([{"Put": {"Item": {"PK": "A", "SK": "B"}}}])
    put = store.client.kwargs["TransactItems"][0]["Put"]
    assert put["Item"]["PK"] == "A"
    assert put["TableName"] == "test-table"

import json
import pytest
from assistant_server import app, FILES, write_json 

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        # Reset all JSON files before each test
        for path in FILES.values():
            write_json(path, [])
        yield client

# Finance Edge Cases

def test_finance_invalid_amount(client):
    # Non-numeric amount
    resp = client.post("/assistant", json={"text": "add expense abc food lunch", "mode": "finance"})
    assert resp.status_code == 400
    assert "Finance Parse Error" in resp.get_json()["reply"]

def test_finance_unknown_command(client):
    resp = client.post("/assistant", json={"text": "foobar money command", "mode": "finance"})
    assert resp.status_code == 400
    assert "Command not recognized" in resp.get_json()["reply"]

def test_finance_missing_mode(client):
    resp = client.post("/assistant", json={"text": "add expense 100 food"})
    assert resp.status_code == 400
    assert "Please select a mode" in resp.get_json()["reply"]


# CRUD Edge Cases

def test_post_transaction_missing_fields(client):
    # Missing 'amount'
    resp = client.post("/api/transactions", json={"desc": "Missing amount"})
    assert resp.status_code == 400
    assert "Invalid data" in resp.get_json()["error"]

def test_delete_nonexistent_transaction(client):
    resp = client.delete("/api/transactions/999999")
    assert resp.status_code == 404
    assert "Transaction ID not found" in resp.get_json()["message"]

# Assistant Edge Cases


def test_assistant_empty_text(client):
    resp = client.post("/assistant", json={"text": "", "mode": "assistant"})
    assert resp.status_code == 400
    assert "Please provide a query" in resp.get_json()["reply"]

def test_assistant_whatsapp_missing_message(client):
    # Simulate sending message without text
    resp = client.post("/assistant", json={"text": "message to Alice", "mode": "assistant"})
    assert resp.status_code == 200
    assert "Please provide the message text" in resp.get_json()["reply"]
def test_assistant_whatsapp_unknown_contact(client):
    resp = client.post("/assistant", json={"text": "message to UnknownContact hello", "mode": "assistant"})
    reply = resp.get_json()["reply"]
    assert "Unknown contact" in reply or "WhatsApp feature is disabled" in reply

# CRUD Endpoint Tests

def test_post_and_get_transaction(client):
    # POST a transaction
    data = {"desc": "Test Expense", "amount": -100, "category": "Food", "type": "Expense"}
    resp = client.post("/api/transactions", json=data)
    assert resp.status_code == 200
    tx_id = resp.get_json()["data"]["id"]

    # GET transactions
    resp2 = client.get("/api/transactions")
    txs = resp2.get_json()["data"]
    assert any(tx["id"] == tx_id for tx in txs)

def test_delete_transaction(client):
    data = {"desc": "Delete Me", "amount": 50, "category": "Other", "type": "Income"}
    resp = client.post("/api/transactions", json=data)
    tx_id = resp.get_json()["data"]["id"]

    # Delete
    del_resp = client.delete(f"/api/transactions/{tx_id}")
    assert del_resp.status_code == 200
    assert del_resp.get_json()["success"] == True

def test_post_and_get_budget(client):
    data = {"name": "Test Budget", "amount": 5000}
    resp = client.post("/api/budgets", json=data)
    assert resp.status_code == 200
    budget_id = resp.get_json()["data"]["id"]

    resp2 = client.get("/api/budgets")
    budgets = resp2.get_json()["data"]
    assert any(b["id"] == budget_id for b in budgets)

def test_post_and_get_goal(client):
    data = {"name": "Test Goal", "target": 10000}
    resp = client.post("/api/goals", json=data)
    assert resp.status_code == 200
    goal_id = resp.get_json()["data"]["id"]

    resp2 = client.get("/api/goals")
    goals = resp2.get_json()["data"]
    assert any(g["id"] == goal_id for g in goals)

# Assistant Endpoint Tests
def test_finance_add_expense(client):
    resp = client.post("/assistant", json={"text": "add expense 200 food lunch", "mode": "finance"})
    data = resp.get_json()
    assert "Added Expense" in data["reply"]

def test_finance_balance(client):
    # Add an expense first
    client.post("/assistant", json={"text": "add expense 100 food lunch", "mode": "finance"})
    resp = client.post("/assistant", json={"text": "what is my balance", "mode": "finance"})
    assert "balance" in resp.get_json()["reply"].lower()

def test_assistant_open_url(client, monkeypatch):
    opened = {}
    def mock_open(url):
        opened["url"] = url
    monkeypatch.setattr("webbrowser.open", mock_open)
    resp = client.post("/assistant", json={"text": "open youtube", "mode": "assistant"})
    assert "youtube.com" in opened["url"]

def test_assistant_unknown_command(client):
    resp = client.post("/assistant", json={"text": "do something unknown", "mode": "assistant"})
    assert resp.status_code == 400
    assert "not understood" in resp.get_json()["reply"].lower()

def test_study_mode(client):
    resp = client.post("/assistant", json={"text": "What is the capital of France?", "mode": "study"})
    assert "france" in resp.get_json()["reply"].lower() or "mock" in resp.get_json()["reply"].lower()

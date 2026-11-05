"""Focused API authorization tests, not browser/end-to-end checkout tests.

Run against development only after the synthetic Alice/Bob seed:
  PYTHONPATH=artifacts/api-server/python uv run pytest artifacts/api-server/python/tests -q
"""
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

# Only this in-process test app receives this ephemeral key. The real gateway's key is never read.
os.environ["RSC_INTERNAL_KEY"] = secrets.token_hex(32)
from retail.main import app
from retail.db import one
from retail.models import CheckoutInput, ReturnInput
from retail.orders import owned_order, return_eligible

def headers(method, path, user=None, **extra):
    raw = json.dumps({"time": int(time.time()), "method": method, "path": path,
                      "subject": user["clerk_id"] if user else None, "ipHash": secrets.token_hex(8),
                      "origin": "https://sandbox.example.com"})
    return {"x-rsc-proof": raw, "x-rsc-signature": hmac.new(os.environ["RSC_INTERNAL_KEY"].encode(),
              raw.encode(), hashlib.sha256).hexdigest(), **extra}

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as client:
        yield client

@pytest.fixture
def alice(client):
    result = one("SELECT * FROM retail.customers WHERE display_name='Alice' AND clerk_id IS NOT NULL")
    assert result, "Run the development seed first"
    return result

@pytest.fixture
def bob(client):
    result = one("SELECT * FROM retail.customers WHERE display_name='Bob' AND clerk_id IS NOT NULL")
    assert result, "Run the development seed first"
    return result

@pytest.mark.parametrize("path", ["/api/me", "/api/orders", "/api/dashboard", "/api/returns", "/api/support/tickets"])
def test_private_routes_need_authenticated_customer(client, path):
    assert client.get(path, headers=headers("GET", path)).status_code == 401

def test_untrusted_gateway_identity_rejected(client, alice):
    path = "/api/orders"
    signed = headers("GET", path, alice)
    signed["x-rsc-proof"] = signed["x-rsc-proof"].replace(alice["clerk_id"], "user_impersonator")
    assert client.get(path, headers=signed).status_code == 401

def test_alice_and_bob_order_lists_are_distinct(client, alice, bob):
    path = "/api/orders"
    a = client.get(path, headers=headers("GET", path, alice)).json()
    b = client.get(path, headers=headers("GET", path, bob)).json()
    assert {"RSC1001", "RSC1003"} <= {x["number"] for x in a}
    assert {"RSC1002", "RSC1004"} <= {x["number"] for x in b}
    assert not ({x["id"] for x in a} & {x["id"] for x in b})

@pytest.mark.parametrize("order_number", ["RSC1001", "RSC1003"])
def test_bob_cannot_read_alice_orders_by_number_or_uuid(client, alice, bob, order_number):
    item = owned_order(order_number, alice)
    for identifier in (str(item["id"]), order_number):
        path = "/api/orders/" + identifier
        assert client.get(path, headers=headers("GET", path, bob)).status_code == 404

def test_customer_selection_query_cannot_change_owner(client, alice, bob):
    path = "/api/orders"
    response = client.get(path, params={"user_id": alice["id"], "email": alice["email"]},
                          headers=headers("GET", path, bob))
    assert response.status_code == 200
    assert all(x["number"] not in {"RSC1001", "RSC1003"} for x in response.json())

def test_bob_cannot_open_alice_ticket(client, alice, bob):
    ticket = one("SELECT id FROM retail.tickets WHERE user_id=%s LIMIT 1", (alice["id"],))
    path = "/api/support/tickets/" + str(ticket["id"])
    assert client.get(path, headers=headers("GET", path, bob)).status_code == 404

def test_bob_cannot_reply_to_alice_ticket(client, alice, bob):
    ticket = one("SELECT id FROM retail.tickets WHERE user_id=%s LIMIT 1", (alice["id"],))
    path = "/api/support/tickets/" + str(ticket["id"]) + "/replies"
    assert client.post(path, json={"body": "Attempted unauthorized customer reply"}, headers=headers("POST", path, bob)).status_code == 404

def test_bob_cannot_return_alice_order(client, alice, bob):
    order = owned_order("RSC1001", alice)
    path = "/api/returns"
    response = client.post(path, json={"orderId": str(order["id"]), "reason": "This is not my purchase record.",
                "kind": "refund", "conditionConfirmed": True}, headers=headers("POST", path, bob))
    assert response.status_code == 404

def test_customers_cannot_use_staff_routes(client, alice):
    path = "/api/admin/overview"
    assert client.get(path, headers=headers("GET", path, alice)).status_code == 403

def test_checkout_payload_cannot_supply_price_or_customer():
    with pytest.raises(ValidationError):
        CheckoutInput.model_validate({"items": [{"slug": "ranger-cap", "quantity": 1}],
          "requestId": str(uuid.uuid4()), "priceCents": 1, "userId": "somebody-else"})

def test_return_requires_unused_condition_attestation():
    with pytest.raises(ValidationError):
        ReturnInput.model_validate({"orderId": str(uuid.uuid4()), "reason": "It does not fit as expected",
                                   "kind": "return", "conditionConfirmed": False})

@pytest.mark.parametrize("days,status,expected", [
    (29, "Delivered", True), (30, "Delivered", True), (31, "Delivered", False),
    (10, "Shipped", False), (-1, "Delivered", False),
])
def test_return_policy_window(days, status, expected):
    now = datetime.now(timezone.utc)
    assert return_eligible({"status": status, "delivered_at": now-timedelta(days=days)}, now) is expected

def test_read_only_integration_token_cannot_write_or_change_customer(client, alice, bob):
    token = "rsc_test_" + secrets.token_urlsafe(32)
    credential_id = uuid.uuid4()
    one("""INSERT INTO retail.integration_credentials(id,user_id,token_hash,scopes,label,expires_at)
      VALUES(%s,%s,%s,ARRAY['orders:read'],'Authorization test',now()+interval '1 minute') RETURNING id""",
      (credential_id, bob["id"], hashlib.sha256(token.encode()).hexdigest()))
    try:
        path = "/api/integration/orders"
        response = client.get(path + "?user_id=" + alice["id"], headers=headers("GET", path, Authorization="Bearer " + token))
        assert response.status_code == 200
        assert all(x["number"] not in {"RSC1001", "RSC1003"} for x in response.json())
        path = "/api/integration/returns"
        response = client.post(path, headers=headers("POST", path, Authorization="Bearer " + token),
            json={"orderId": str(owned_order("RSC1004", bob)["id"]), "reason": "I would like to return this item",
                  "kind": "return", "conditionConfirmed": True})
        assert response.status_code == 403
    finally:
        one("DELETE FROM retail.integration_credentials WHERE id=%s RETURNING id", (credential_id,))

@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("identifier", ["id", "number"])
def test_order_status_enforces_bilateral_customer_ownership(client, alice, bob, reverse, identifier):
    owner, other = (bob, alice) if reverse else (alice, bob)
    order = one("SELECT * FROM retail.orders WHERE user_id=%s LIMIT 1", (owner["id"],))
    path = f'/api/orders/{order[identifier]}/status'
    own = client.get(path, headers=headers("GET", path, owner))
    assert own.status_code == 200
    assert own.json()["customerId"] == owner["id"]
    assert {"status", "shippingStatus", "returnStatus"} <= own.json().keys()
    assert client.get(path, headers=headers("GET", path, other)).status_code == 404
    assert client.get(path, params={"user_id": owner["id"], "email": owner["email"]},
                      headers=headers("GET", path, other)).status_code == 404
    assert client.get(path, headers=headers("GET", path)).status_code == 401

def test_simulated_checkout_is_owned_idempotent_and_uses_server_prices(client, alice, bob):
    path = "/api/checkout"
    request_id = str(uuid.uuid4())
    body = {"requestId": request_id, "items": [{"slug": "campfire-fleece", "size": "M", "quantity": 1}]}
    order_id = None
    try:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(lambda _: client.post(path, json=body, headers=headers("POST", path, alice)), range(3)))
        assert all(result.status_code == 200 for result in results)
        assert len({result.json()["sessionId"] for result in results}) == 1
        session = results[0].json()["sessionId"]
        assert session.startswith("sim_")
        assert results[0].json()["url"].startswith("/checkout/success?")
        status_path = f"/api/checkout/sessions/{session}"
        receipt = client.get(status_path, headers=headers("GET", status_path, alice))
        assert receipt.status_code == 200 and receipt.json()["state"] == "completed"
        order_id = receipt.json()["orderId"]
        order = one("SELECT * FROM retail.orders WHERE id=%s", (order_id,))
        price = one("SELECT price_cents FROM retail.products WHERE slug='campfire-fleece'")["price_cents"]
        assert order["synthetic"] is True
        assert order["user_id"] == alice["id"] and order["subtotal_cents"] == price
        assert "payment" not in results[0].json()
        assert client.get(status_path, headers=headers("GET", status_path, bob)).status_code == 404
        assert client.get(status_path, headers=headers("GET", status_path)).status_code == 401
        changed = {**body, "items": [{"slug": "campfire-fleece", "size": "M", "quantity": 2}]}
        assert client.post(path, json=changed, headers=headers("POST", path, alice)).status_code == 409
        assert client.post(path, json={**body, "userId": bob["id"]}, headers=headers("POST", path, alice)).status_code == 422
        assert client.post(path, json=body, headers=headers("POST", path)).status_code == 401
    finally:
        checkout = one("DELETE FROM retail.simulated_checkouts WHERE user_id=%s AND request_id=%s RETURNING order_id", (alice["id"], request_id))
        if checkout:
            order_id = checkout["order_id"]
        if order_id:
            for table in ("shipping_events", "order_items"):
                one(f"DELETE FROM retail.{table} WHERE order_id=%s RETURNING id", (order_id,))
            one("DELETE FROM retail.orders WHERE id=%s RETURNING id", (order_id,))

@pytest.mark.parametrize("reverse", [False, True])
def test_zendesk_status_credential_is_bound_to_one_customer(client, alice, bob, reverse):
    owner, other = (bob, alice) if reverse else (alice, bob)
    token = secrets.token_urlsafe(32)
    credential_id = uuid.uuid4()
    one("""INSERT INTO retail.integration_credentials(id,user_id,token_hash,scopes,label,expires_at)
      VALUES(%s,%s,%s,ARRAY['orders:read'],'Fictional order-status test',now()+interval '1 minute') RETURNING id""",
      (credential_id, owner["id"], hashlib.sha256(token.encode()).hexdigest()))
    try:
        for target, expected in [(owner, 200), (other, 404)]:
            order = one("SELECT * FROM retail.orders WHERE user_id=%s LIMIT 1", (target["id"],))
            for identifier in (str(order["id"]), order["number"]):
                path = f"/api/integration/orders/{identifier}/status"
                response = client.get(path, params={"user_id": target["id"]},
                    headers=headers("GET", path, Authorization="Bearer " + token))
                assert response.status_code == expected
        path = f"/api/integration/orders/{order['id']}/status"
        assert client.get(path, headers=headers("GET", path)).status_code == 401
        one("UPDATE retail.integration_credentials SET scopes=ARRAY['returns:read'] WHERE id=%s RETURNING id", (credential_id,))
        assert client.get(path, headers=headers("GET", path, Authorization="Bearer " + token)).status_code == 403
        one("UPDATE retail.integration_credentials SET revoked_at=now() WHERE id=%s RETURNING id", (credential_id,))
        assert client.get(path, headers=headers("GET", path, Authorization="Bearer " + token)).status_code == 401
    finally:
        one("DELETE FROM retail.integration_credentials WHERE id=%s RETURNING id", (credential_id,))


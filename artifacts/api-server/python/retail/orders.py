import hashlib
import json
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from psycopg.errors import UniqueViolation
from .db import rows, one, transaction
from .security import customer, integration_customer
from .models import CheckoutInput, ReturnInput, OrderStatus
from .catalog import products

router = APIRouter()

def iso(value):
    return value.isoformat() if value else None

def return_eligible(order, now=None):
    now = now or datetime.now(timezone.utc)
    delivered = order["delivered_at"]
    return bool(order["status"] == "Delivered" and delivered and
                delivered <= now <= delivered + timedelta(days=30))

def order_view(order):
    items = rows("SELECT * FROM retail.order_items WHERE order_id=%s ORDER BY name", (order["id"],))
    events = rows("SELECT * FROM retail.shipping_events WHERE order_id=%s ORDER BY created_at", (order["id"],))
    eligible = return_eligible(order)
    latest_return = one("SELECT status FROM retail.return_requests WHERE order_id=%s ORDER BY created_at DESC LIMIT 1", (order["id"],))
    return {"id": str(order["id"]), "number": order["number"], "status": order["status"],
        "customerId": order["user_id"], "shippingStatus": events[-1]["status"] if events else "Not shipped",
        "returnStatus": latest_return["status"] if latest_return else "None",
        "subtotalCents": order["subtotal_cents"], "shippingCents": order["shipping_cents"],
        "totalCents": order["total_cents"], "createdAt": iso(order["created_at"]),
        "deliveredAt": iso(order["delivered_at"]), "trackingNumber": order["tracking_number"],
        "carrier": order["carrier"], "returnEligible": eligible, "synthetic": order["synthetic"],
        "items": [{"slug": x["slug"], "name": x["name"], "quantity": x["quantity"],
            "priceCents": x["price_cents"], "size": x["size"], "image": x["image"]} for x in items],
        "events": [{"status": x["status"], "description": x["description"],
            "createdAt": iso(x["created_at"])} for x in events]}

def owned_order(order_id, user):
    # UUID or displayed order number identifies a record, never authenticates its owner.
    order = one("SELECT * FROM retail.orders WHERE (id::text=%s OR number=%s) AND user_id=%s",
                (order_id, order_id, user["id"]))
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@router.get("/orders")
def list_orders(request: Request):
    user = customer(request)
    return [order_view(x) for x in rows("SELECT * FROM retail.orders WHERE user_id=%s ORDER BY created_at DESC", (user["id"],))]

@router.get("/orders/{order_id}")
def get_order(order_id: str, request: Request):
    return order_view(owned_order(order_id, customer(request)))

def status_view(order):
    view = order_view(order)
    return {key: view[key] for key in ("id", "number", "customerId", "status", "shippingStatus",
                                      "returnStatus", "trackingNumber", "carrier", "synthetic")}

@router.get("/orders/{order_id}/status", response_model=OrderStatus, summary="Get the authenticated customer's order status",
            description="Accepts an order UUID or order number. Ownership is checked server-side. Other customers' orders return 404.")
def order_status(order_id: str, request: Request):
    return status_view(owned_order(order_id, customer(request)))

@router.post("/checkout")
def create_checkout(body: CheckoutInput, request: Request):
    user = customer(request)
    catalog = {p["slug"]: p for p in products()}
    items = []
    seen = set()
    for item in body.items:
        product = catalog.get(item.slug)
        if not product or item.size not in product["sizes"] or (item.slug, item.size) in seen:
            raise HTTPException(400, "Invalid product, size or duplicate cart line")
        seen.add((item.slug, item.size))
        items.append({"slug": product["slug"], "name": product["name"], "quantity": item.quantity,
                      "priceCents": product["priceCents"], "size": item.size, "image": product["image"]})
    subtotal = sum(x["quantity"] * x["priceCents"] for x in items)
    shipping = 0 if subtotal >= 7500 else 695
    cart_hash = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()
    with transaction() as connection:
        # Serialize retries per authenticated owner/request, including concurrent submissions.
        connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                           (f'{user["id"]}:{body.requestId}',))
        checkout = connection.execute("SELECT * FROM retail.simulated_checkouts WHERE user_id=%s AND request_id=%s",
                                      (user["id"], body.requestId)).fetchone()
        if checkout:
            if checkout["cart_hash"] != cart_hash:
                raise HTTPException(409, "Request ID was already used for a different cart")
            session_id = checkout["id"]
        else:
            session_id = "sim_" + uuid.uuid4().hex
            order_id = uuid.uuid4()
            connection.execute("""INSERT INTO retail.orders
              (id,number,user_id,status,subtotal_cents,shipping_cents,total_cents,synthetic)
              VALUES(%s,%s,%s,'Processing',%s,%s,%s,true)""",
              (order_id, "SIM-" + uuid.uuid4().hex.upper(), user["id"], subtotal, shipping, subtotal + shipping))
            for item in items:
                connection.execute("""INSERT INTO retail.order_items(id,order_id,slug,name,price_cents,quantity,size,image)
                  VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""", (uuid.uuid4(), order_id, item["slug"], item["name"],
                  item["priceCents"], item["quantity"], item["size"], item["image"]))
            connection.execute("""INSERT INTO retail.shipping_events(id,order_id,status,description)
              VALUES(%s,%s,'Not shipped','Fictional order created for authorized security research; no payment or shipment.')""",
              (uuid.uuid4(), order_id))
            connection.execute("""INSERT INTO retail.simulated_checkouts(id,user_id,request_id,cart_hash,order_id)
              VALUES(%s,%s,%s,%s,%s)""", (session_id, user["id"], body.requestId, cart_hash, order_id))
    return {"url": f"/checkout/success?session_id={session_id}", "sessionId": session_id}

@router.get("/checkout/sessions/{session_id}")
def checkout_status(session_id: str, request: Request):
    user = customer(request)
    intent = one("SELECT * FROM retail.simulated_checkouts WHERE id=%s AND user_id=%s", (session_id, user["id"]))
    if not intent:
        raise HTTPException(404, "Checkout not found")
    return {"state": "completed", "orderId": str(intent["order_id"])}

def return_view(item):
    return {"id": str(item["id"]), "orderId": str(item["order_id"]), "orderNumber": item["number"],
            "reason": item["reason"], "kind": item["kind"], "status": item["status"], "createdAt": iso(item["created_at"])}

def returns_for(user):
    return [return_view(x) for x in rows("""SELECT r.*,o.number FROM retail.return_requests r
      JOIN retail.orders o ON o.id=r.order_id WHERE r.user_id=%s ORDER BY r.created_at DESC""", (user["id"],))]

def request_return(body, user):
    order = owned_order(body.orderId, user)
    if not return_eligible(order):
        raise HTTPException(409, "Returns are available within 30 days of delivery for delivered orders")
    try:
        item = one("""INSERT INTO retail.return_requests(id,order_id,user_id,reason,kind,condition_confirmed)
          VALUES(%s,%s,%s,%s,%s,true) RETURNING *""", (uuid.uuid4(), order["id"], user["id"], body.reason, body.kind))
    except UniqueViolation:
        raise HTTPException(409, "An active request already exists for this order")
    return return_view({**item, "number": order["number"]})

@router.get("/returns")
def list_returns(request: Request):
    return returns_for(customer(request))

@router.post("/returns", status_code=201)
def create_return(body: ReturnInput, request: Request):
    return request_return(body, customer(request))

@router.get("/integration/orders")
def integration_orders(request: Request):
    user = integration_customer(request, "orders:read")
    return [order_view(x) for x in rows("SELECT * FROM retail.orders WHERE user_id=%s ORDER BY created_at DESC", (user["id"],))]

@router.get("/integration/orders/{order_id}")
def integration_order(order_id: str, request: Request):
    return order_view(owned_order(order_id, integration_customer(request, "orders:read")))

@router.get("/integration/orders/{order_id}/status", response_model=OrderStatus, summary="Customer-scoped order status for a future Zendesk custom action",
            description="Bearer integration credential bound server-side to one customer with orders:read scope. Order IDs, emails and query parameters never change the credential's owner.")
def integration_order_status(order_id: str, request: Request):
    return status_view(owned_order(order_id, integration_customer(request, "orders:read")))

@router.get("/integration/returns")
def integration_returns(request: Request):
    return returns_for(integration_customer(request, "returns:read"))

@router.post("/integration/returns", status_code=201)
def integration_return(body: ReturnInput, request: Request):
    return request_return(body, integration_customer(request, "returns:create"))

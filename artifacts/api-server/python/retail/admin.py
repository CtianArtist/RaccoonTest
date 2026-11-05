import hashlib
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Request
from .db import one, rows, transaction
from .security import staff, administrator
from .models import ModerationInput, TicketStatusInput, ReturnStatusInput, ShippingInput, CredentialInput
from .community import discussion_view
from .support import ticket_view, authorized_ticket
from .orders import order_view, return_view, iso

router = APIRouter()

def audit(user, action, resource_id):
    one("INSERT INTO retail.audit(user_id,action,resource_id) VALUES(%s,%s,%s) RETURNING id",
        (user["id"], action, str(resource_id)))

@router.get("/admin/overview")
def overview(request: Request):
    user = staff(request)
    return {
        "pendingDiscussions": [discussion_view(d, user) for d in rows("SELECT * FROM retail.discussions WHERE NOT approved ORDER BY updated_at DESC LIMIT 100")],
        "pendingReplies": [{"id": str(r["id"]), "body": r["body"], "authorName": r["display_name"],
          "authorId": r["author_id"], "hidden": True, "createdAt": iso(r["created_at"])}
          for r in rows("SELECT r.*,u.display_name FROM retail.replies r JOIN retail.customers u ON u.id=r.author_id WHERE hidden=true ORDER BY created_at DESC LIMIT 100")],
        "tickets": [ticket_view(t) for t in rows("SELECT * FROM retail.tickets ORDER BY created_at DESC LIMIT 100")],
        "returns": [return_view(r) for r in rows("SELECT r.*,o.number FROM retail.return_requests r JOIN retail.orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 100")],
        "orders": [order_view(o) for o in rows("SELECT * FROM retail.orders ORDER BY created_at DESC LIMIT 100")],
        "userCount": one("SELECT count(*)::int AS count FROM retail.customers")["count"],
    }

@router.post("/admin/moderate")
def moderate(body: ModerationInput, request: Request):
    user = staff(request)
    # All identifiers and SQL fragments below are fixed server allow-lists.
    columns = {"publish": ("approved", True), "hide": ("approved", False),
               "lock": ("locked", True), "unlock": ("locked", False)}
    with transaction() as connection:
        if body.action in columns:
            column, value = columns[body.action]
            changed = connection.execute(f"UPDATE retail.discussions SET {column}=%s,updated_at=now() WHERE id=%s RETURNING id", (value, body.id)).fetchone()
        else:
            changed = connection.execute("UPDATE retail.replies SET hidden=%s WHERE id=%s RETURNING discussion_id AS id",
                                         (body.action == "hide-reply", body.id)).fetchone()
            if changed:
                connection.execute("UPDATE retail.discussions SET updated_at=now() WHERE id=%s", (changed["id"],))
    if not changed:
        raise HTTPException(404, "Content not found")
    audit(user, "community:" + body.action, body.id)
    return {"ok": True}

@router.patch("/admin/tickets/{ticket_id}/status")
def ticket_status(ticket_id: str, body: TicketStatusInput, request: Request):
    user = staff(request)
    ticket = authorized_ticket(ticket_id, user)
    ticket = one("UPDATE retail.tickets SET status=%s WHERE id=%s RETURNING *", (body.status, ticket["id"]))
    audit(user, "ticket:" + body.status, ticket_id)
    return ticket_view(ticket)

@router.patch("/admin/returns/{return_id}/status")
def return_status(return_id: str, body: ReturnStatusInput, request: Request):
    user = staff(request)
    item = one("SELECT * FROM retail.return_requests WHERE id::text=%s", (return_id,))
    if not item:
        raise HTTPException(404, "Request not found")
    allowed = {"Requested": {"Approved", "Rejected"}, "Approved": {"Inspected", "Rejected"},
               "Rejected": set(), "Inspected": set()}
    if body.status not in allowed[item["status"]]:
        raise HTTPException(409, "Invalid return lifecycle transition")
    item = one("UPDATE retail.return_requests SET status=%s WHERE id=%s RETURNING *", (body.status, item["id"]))
    order = one("SELECT number FROM retail.orders WHERE id=%s", (item["order_id"],))
    audit(user, "return:" + body.status, item["id"])
    # Inspection only updates the fictional return-request record.
    return return_view({**item, "number": order["number"]})

@router.post("/admin/orders/{order_id}/shipping")
def shipping(order_id: str, body: ShippingInput, request: Request):
    user = staff(request)
    with transaction() as connection:
        item = connection.execute("SELECT * FROM retail.orders WHERE id::text=%s FOR UPDATE", (order_id,)).fetchone()
        if not item:
            raise HTTPException(404, "Order not found")
        sequence = ["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"]
        if body.status not in sequence or sequence.index(body.status) < sequence.index(item["status"]):
            raise HTTPException(409, "Shipping status cannot move backward")
        connection.execute("""UPDATE retail.orders SET status=%s,
          delivered_at=CASE WHEN %s='Delivered' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,
          carrier=CASE WHEN %s IN ('Shipped','Out for delivery','Delivered') THEN 'Raccoon sandbox carrier' ELSE carrier END,
          tracking_number=CASE WHEN %s IN ('Shipped','Out for delivery','Delivered') THEN COALESCE(tracking_number,%s) ELSE tracking_number END
          WHERE id=%s""", (body.status, body.status, body.status, body.status,
                          "SIM-" + str(item["id"]).replace("-", "")[:12].upper(), item["id"]))
        connection.execute("INSERT INTO retail.shipping_events(id,order_id,status,description) VALUES(%s,%s,%s,%s)",
                           (uuid.uuid4(), item["id"], body.status, body.description))
    audit(user, "shipping:" + body.status, order_id)
    return order_view(one("SELECT * FROM retail.orders WHERE id::text=%s", (order_id,)))

@router.post("/admin/service-credentials", status_code=201)
def create_credential(body: CredentialInput, request: Request):
    user = administrator(request)
    if not one("SELECT id FROM retail.customers WHERE id=%s", (body.userId,)):
        raise HTTPException(404, "Customer not found")
    token = "rsc_test_" + secrets.token_urlsafe(32)
    item = one("""INSERT INTO retail.integration_credentials(id,user_id,token_hash,scopes,label,expires_at)
        VALUES(%s,%s,%s,%s,%s,now()+interval '1 day') RETURNING id,expires_at""",
        (uuid.uuid4(), body.userId, hashlib.sha256(token.encode()).hexdigest(), list(set(body.scopes)), body.label))
    audit(user, "credential:issue", item["id"])
    return {"id": str(item["id"]), "token": token, "expiresAt": iso(item["expires_at"])}

@router.delete("/admin/service-credentials/{credential_id}")
def revoke_credential(credential_id: str, request: Request):
    user = administrator(request)
    item = one("UPDATE retail.integration_credentials SET revoked_at=now() WHERE id::text=%s RETURNING id", (credential_id,))
    if not item:
        raise HTTPException(404, "Credential not found")
    audit(user, "credential:revoke", credential_id)
    return {"ok": True}

@router.get("/admin/diagnostics")
def diagnostics(request: Request):
    administrator(request)
    return {"database": "healthy", "checkoutMode": "simulated",
            "recentOperations": [{"action": a["action"], "createdAt": iso(a["created_at"])}
                                for a in rows("SELECT action,created_at FROM retail.audit ORDER BY id DESC LIMIT 30")]}

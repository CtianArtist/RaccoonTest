import uuid
from fastapi import APIRouter, HTTPException, Request
from .db import rows, one
from .security import customer, integration_customer
from .models import TicketInput, MessageInput
from .orders import iso

router = APIRouter()

def ticket_view(ticket):
    messages = rows("""SELECT m.*,u.display_name FROM retail.ticket_messages m
      JOIN retail.customers u ON u.id=m.author_id WHERE ticket_id=%s ORDER BY created_at""", (ticket["id"],))
    return {"id": str(ticket["id"]), "subject": ticket["subject"], "description": ticket["description"],
            "category": ticket["category"], "status": ticket["status"], "createdAt": iso(ticket["created_at"]),
            "messages": [{"id": str(m["id"]), "body": m["body"], "authorName": m["display_name"],
                          "authorId": m["author_id"], "createdAt": iso(m["created_at"]), "hidden": False} for m in messages]}

def authorized_ticket(ticket_id, user, allow_staff=True):
    ticket = one("SELECT * FROM retail.tickets WHERE id::text=%s", (ticket_id,))
    if not ticket or (ticket["user_id"] != user["id"] and not (allow_staff and user["role"] in ("staff", "admin"))):
        raise HTTPException(404, "Support request not found")
    return ticket

@router.get("/support/tickets")
def list_tickets(request: Request):
    user = customer(request)
    return [ticket_view(x) for x in rows("SELECT * FROM retail.tickets WHERE user_id=%s ORDER BY created_at DESC", (user["id"],))]

@router.post("/support/tickets", status_code=201)
def create_ticket(body: TicketInput, request: Request):
    user = customer(request)
    ticket = one("""INSERT INTO retail.tickets(id,user_id,subject,description,category)
      VALUES(%s,%s,%s,%s,%s) RETURNING *""", (uuid.uuid4(), user["id"], body.subject, body.description, body.category))
    return ticket_view(ticket)

@router.get("/support/tickets/{ticket_id}")
def get_ticket(ticket_id: str, request: Request):
    return ticket_view(authorized_ticket(ticket_id, customer(request)))

@router.post("/support/tickets/{ticket_id}/replies", status_code=201)
def reply_to_ticket(ticket_id: str, body: MessageInput, request: Request):
    user = customer(request)
    ticket = authorized_ticket(ticket_id, user)
    if ticket["status"] == "Closed":
        raise HTTPException(409, "This request is closed")
    one("INSERT INTO retail.ticket_messages(id,ticket_id,author_id,body) VALUES(%s,%s,%s,%s) RETURNING id",
        (uuid.uuid4(), ticket["id"], user["id"], body.body))
    return ticket_view(ticket)

@router.get("/integration/support/tickets/{ticket_id}")
def integration_ticket(ticket_id: str, request: Request):
    return ticket_view(authorized_ticket(ticket_id, integration_customer(request, "tickets:read"), allow_staff=False))

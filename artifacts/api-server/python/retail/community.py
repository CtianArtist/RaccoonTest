import math
import re
import uuid
from fastapi import APIRouter, HTTPException, Request, Query
from .db import rows, one, transaction
from .security import customer, optional_customer
from .orders import iso
from .models import DiscussionInput, MessageInput

router = APIRouter()

def discussion_view(item, viewer=None):
    privileged = viewer and (viewer["role"] in ("staff", "admin"))
    replies = rows("""SELECT r.*,u.display_name FROM retail.replies r
        JOIN retail.customers u ON u.id=r.author_id WHERE discussion_id=%s
        AND (hidden=false OR author_id=%s OR %s) ORDER BY created_at""",
        (item["id"], viewer["id"] if viewer else "", bool(privileged)))
    author = one("SELECT display_name FROM retail.customers WHERE id=%s", (item["author_id"],))
    return {"id": str(item["id"]), "slug": item["slug"], "title": item["title"],
            "category": item["category"], "body": item["body"], "authorId": item["author_id"],
            "authorName": author["display_name"], "createdAt": iso(item["created_at"]),
            "updatedAt": iso(item["updated_at"]), "approved": item["approved"], "locked": item["locked"],
            "replies": [{"id": str(r["id"]), "body": r["body"], "authorId": r["author_id"],
                "authorName": r["display_name"], "createdAt": iso(r["created_at"]), "hidden": r["hidden"]} for r in replies]}

def visible_discussion(slug, viewer=None):
    item = one("SELECT * FROM retail.discussions WHERE slug=%s", (slug,))
    if not item or (not item["approved"] and not (viewer and
        (viewer["id"] == item["author_id"] or viewer["role"] in ("staff", "admin")))):
        raise HTTPException(404, "Discussion not found")
    return item

def category_list():
    return [{"slug": c["slug"], "name": c["name"], "description": c["description"], "count": c["count"]}
        for c in rows("""SELECT c.*,count(d.id)::int AS count FROM retail.categories c
         LEFT JOIN retail.discussions d ON c.slug=d.category AND d.approved
         GROUP BY c.slug ORDER BY c.name""")]

def discussion_list(q="", category="", page=1):
    filters = (f"%{q[:200]}%", f"%{q[:200]}%", category, category)
    where = "approved=true AND (title ILIKE %s OR body ILIKE %s) AND (%s='' OR category=%s)"
    count = one("SELECT count(*)::int AS count FROM retail.discussions WHERE " + where, filters)["count"]
    items = rows("SELECT * FROM retail.discussions WHERE " + where + " ORDER BY updated_at DESC LIMIT 10 OFFSET %s",
                 (*filters, (page - 1) * 10))
    return {"items": [discussion_view(x) for x in items], "total": count, "page": page,
            "pages": max(1, math.ceil(count / 10))}

@router.get("/community/categories")
def categories():
    return category_list()

@router.get("/community/discussions")
def discussions(q: str = "", category: str = "", page: int = Query(default=1, ge=1, le=1000)):
    return discussion_list(q, category, page)

@router.get("/community/history")
def history(request: Request):
    user = customer(request)
    return [discussion_view(d, user) for d in rows("""SELECT DISTINCT d.* FROM retail.discussions d
       LEFT JOIN retail.replies r ON r.discussion_id=d.id WHERE d.author_id=%s OR r.author_id=%s
       ORDER BY d.updated_at DESC LIMIT 100""", (user["id"], user["id"]))]

@router.post("/community/discussions", status_code=201)
def create_discussion(body: DiscussionInput, request: Request):
    user = customer(request)
    if not one("SELECT slug FROM retail.categories WHERE slug=%s", (body.category,)):
        raise HTTPException(400, "Choose an existing category")
    slug = re.sub(r"[^a-z0-9]+", "-", body.title.lower()).strip("-")[:100] + "-" + uuid.uuid4().hex[:8]
    item = one("""INSERT INTO retail.discussions(id,slug,title,category,body,author_id)
        VALUES(%s,%s,%s,%s,%s,%s) RETURNING *""", (uuid.uuid4(), slug, body.title, body.category, body.body, user["id"]))
    return discussion_view(item, user)

@router.get("/community/discussions/{slug}")
def get_discussion(slug: str, request: Request):
    viewer = optional_customer(request)
    return discussion_view(visible_discussion(slug, viewer), viewer)

@router.patch("/community/discussions/{slug}")
def edit_discussion(slug: str, body: MessageInput, request: Request):
    user = customer(request)
    item = visible_discussion(slug, user)
    if item["author_id"] != user["id"]:
        raise HTTPException(403, "Only the author may edit this post")
    if item["locked"]:
        raise HTTPException(409, "This discussion is locked")
    item = one("""UPDATE retail.discussions SET body=%s,approved=false,updated_at=now()
        WHERE id=%s AND author_id=%s RETURNING *""", (body.body, item["id"], user["id"]))
    return discussion_view(item, user)

@router.post("/community/discussions/{slug}/replies", status_code=201)
def reply(slug: str, body: MessageInput, request: Request):
    user = customer(request)
    item = visible_discussion(slug, user)
    if item["locked"]:
        raise HTTPException(409, "This discussion is locked")
    one("INSERT INTO retail.replies(id,discussion_id,author_id,body) VALUES(%s,%s,%s,%s) RETURNING id",
        (uuid.uuid4(), item["id"], user["id"], body.body))
    return discussion_view(item, user)

@router.patch("/community/posts/{post_id}")
def edit_reply(post_id: str, body: MessageInput, request: Request):
    user = customer(request)
    item = one("""SELECT r.*,d.locked FROM retail.replies r JOIN retail.discussions d ON d.id=r.discussion_id
        WHERE r.id::text=%s""", (post_id,))
    if not item:
        raise HTTPException(404, "Reply not found")
    if item["author_id"] != user["id"]:
        raise HTTPException(403, "Only the author may edit this reply")
    if item["locked"]:
        raise HTTPException(409, "This discussion is locked")
    with transaction() as connection:
        connection.execute("UPDATE retail.replies SET body=%s,hidden=true WHERE id=%s", (body.body, item["id"]))
        connection.execute("UPDATE retail.discussions SET updated_at=now() WHERE id=%s", (item["discussion_id"],))
    return {"ok": True}

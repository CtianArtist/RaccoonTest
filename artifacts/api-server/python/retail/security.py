"""Private gateway proofs; no local passwords and no browser-controlled identity."""
import hashlib
import hmac
import json
import os
import time
from fastapi import HTTPException, Request
from .db import one

def proof(request: Request):
    raw = request.headers.get("x-rsc-proof", "")
    signature = request.headers.get("x-rsc-signature", "")
    key = os.environ["RSC_INTERNAL_KEY"]
    expected = hmac.new(key.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not raw or not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "Invalid gateway proof")
    try:
        data = json.loads(raw)
        if abs(time.time() - data["time"]) > 30:
            raise ValueError()
        if data["method"] != request.method or data["path"] != str(request.url.path):
            raise ValueError()
        return data
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Expired or invalid gateway proof")

def optional_customer(request: Request):
    identity = proof(request)
    subject = identity.get("subject")
    if not subject:
        return None
    # Identity comes only from the verified Clerk middleware in the private gateway.
    customer = one("SELECT * FROM retail.customers WHERE clerk_id=%s", (subject,))
    if customer:
        return customer
    return one("""INSERT INTO retail.customers(id,clerk_id,display_name,email)
        VALUES(%s,%s,%s,%s) ON CONFLICT(clerk_id) DO UPDATE SET clerk_id=EXCLUDED.clerk_id
        RETURNING *""", (subject, subject, identity.get("name") or "Customer",
                         identity.get("email") or ""))

def customer(request: Request):
    user = optional_customer(request)
    if not user:
        raise HTTPException(401, "Sign in to access your account")
    return user

def staff(request: Request):
    user = customer(request)
    if user["role"] not in ("staff", "admin"):
        raise HTTPException(403, "Staff access required")
    return user

def administrator(request: Request):
    user = staff(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator access required")
    return user

def integration_customer(request: Request, scope: str):
    proof(request)
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Integration credential required")
    token_hash = hashlib.sha256(auth[7:].encode()).hexdigest()
    credential = one("""SELECT * FROM retail.integration_credentials
        WHERE token_hash=%s AND revoked_at IS NULL AND expires_at>now()""", (token_hash,))
    if not credential:
        raise HTTPException(401, "Invalid or expired integration credential")
    if scope not in credential["scopes"]:
        raise HTTPException(403, "Credential does not permit this action")
    return one("SELECT * FROM retail.customers WHERE id=%s", (credential["user_id"],))

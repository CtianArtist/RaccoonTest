import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from . import catalog, orders, support, community, admin, public_web
from .db import pool, one
from .security import customer, proof

@asynccontextmanager
async def lifespan(app):
    pool.open()
    pool.wait(timeout=20)
    yield
    pool.close()

app = FastAPI(title="Raccoon Supply Co. Sandbox API", version="1.0.0",
              docs_url="/api/docs", openapi_url="/api/openapi.json", lifespan=lifespan)
for module in (catalog, orders, support, community, admin):
    app.include_router(module.router, prefix="/api")
app.include_router(public_web.router)

@app.middleware("http")
async def protections(request: Request, call_next):
    try:
        identity = proof(request)
        if request.method not in ("GET", "HEAD", "OPTIONS") and not request.url.path.startswith("/internal/"):
            # Persistent rate limit; IP is hashed by the gateway, never logged here.
            key = identity.get("ipHash", "unknown")
            limit = one("""INSERT INTO retail.rate_limits(key) VALUES(%s)
              ON CONFLICT(key) DO UPDATE SET
              count=CASE WHEN retail.rate_limits.starts_at<now()-interval '1 minute' THEN 1 ELSE retail.rate_limits.count+1 END,
              starts_at=CASE WHEN retail.rate_limits.starts_at<now()-interval '1 minute' THEN now() ELSE retail.rate_limits.starts_at END
              RETURNING count""", (key,))
            if limit["count"] > 100:
                return JSONResponse({"error": "Please wait a minute before trying again"}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse({"error": exc.detail}, status_code=exc.status_code)
    except Exception as exc:
        logging.getLogger("raccoon").error("Business request failed: %s", type(exc).__name__)
        response = JSONResponse({"error": "Service temporarily unavailable"}, status_code=503)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    if not request.url.path.startswith("/community"):
        response.headers["X-Robots-Tag"] = "noindex"
    return response

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo arbitrary request input or sensitive values.
    return JSONResponse({"error": "Please check the required fields and valid values."}, status_code=422)

@app.get("/api/healthz")
@app.get("/api/health")
def health():
    one("SELECT 1 AS healthy")
    return {"status": "ok"}

@app.get("/api/me")
def me(request: Request):
    user = customer(request)
    return {"id": user["id"], "displayName": user["display_name"], "email": user["email"], "role": user["role"]}

@app.get("/api/dashboard")
def dashboard(request: Request):
    user = customer(request)
    order_list = orders.list_orders(request)
    return {"customer": me(request), "orderCount": len(order_list),
            "activeOrders": sum(o["status"] != "Delivered" for o in order_list),
            "returnCount": len(orders.returns_for(user)), "spentCents": sum(o["totalCents"] for o in order_list),
            "recentOrders": order_list[:4]}


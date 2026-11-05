# Raccoon Supply Co. retail API

## Application structure

The existing forest-green/cream React storefront is retained. The public API gateway
uses managed Clerk cookie sessions, proxies the managed Clerk frontend endpoint,
validates CSRF tokens, and forwards requests to the private business API.
All business rules and customer ownership checks are implemented in Python FastAPI.
FastAPI listens only on loopback and requires a per-process, short-lived HMAC proof
from the gateway. No public endpoint can choose another customer's identity.

PostgreSQL stores application records in `retail`. The product inventory is
application data seeded with 12 fictional products.

## Simulated checkout

Checkout creates a synthetic order directly in PostgreSQL, including its unique
order number, authenticated owner, order status and shipping event. Return status
is derived from the order's persisted return requests. Catalog pricing and shipping
costs are fictional and calculated server-side.

Only SKU, size, quantity and an idempotency UUID are accepted. Atomic transactions
and owner/request idempotency prevent duplicate orders. Checkout sessions and
receipt pages enforce customer ownership. The bag clears only after the owned
order record loads. The site does not collect card details, charge money, or create
real shipments.

See **[Order-status and future Zendesk action API](order-status-api.md)** for
the documented customer-scoped endpoints, setup and tests.

No payment credentials or payment-provider integrations are used by the app.

## Customer API

Interactive request documentation: **`/api/docs`**.
The complete shared request/response contract is `lib/api-spec/openapi.yaml`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products`, `/api/products/:slug` | Public inventory; optional `q`, `category` |
| GET | `/api/auth/csrf` | Session-bound token for cookie-authenticated mutations |
| GET | `/api/me`, `/api/dashboard` | Verified identity and own customer summary |
| GET | `/api/orders`, `/api/orders/:id` | Own orders/items/shipping events only |
| POST | `/api/checkout` | Creates a local fictional order |
| GET | `/api/checkout/sessions/:sessionId` | Own simulated checkout receipt status |
| GET, POST | `/api/returns` | Own requests; order ownership and 30-day eligibility |
| GET, POST | `/api/support/tickets` | Own private tickets |
| GET | `/api/support/tickets/:id` | Owner or staff only |
| POST | `/api/support/tickets/:id/replies` | Owner or staff reply |
| GET | `/api/community/categories` | Public category index |
| GET, POST | `/api/community/discussions` | Public list/search/paging; signed-in author creation |
| GET, PATCH | `/api/community/discussions/:slug` | View; only author may edit |
| POST | `/api/community/discussions/:slug/replies` | Signed-in reply, moderation pending |
| PATCH | `/api/community/posts/:id` | Author-only reply edit, moderation reset |
| GET | `/api/community/history` | Authenticated customer's posting history |

All unsafe browser requests use `X-CSRF-Token`; the generated client's fetch helper
obtains it automatically using cookie sessions. Missing authentication is 401,
insufficient role/scope is 403, and private records not owned by the caller are 404.
Client-supplied identity, email and order numbers cannot confer ownership.

Returns require unused/unwashed/original condition within 30 days of delivery.
Refund requests and their review statuses are fictional records only. They do not
move money or contact a payment provider. Support: `support@raccoonsupplyco.zendesk.com`.

## Staff administration

`/admin` provides moderation, ticket lifecycle, return review and simulated shipping
updates. Database roles—not browser input—authorize staff/admin operations.
To make a verified account an administrator, sign in and visit Account, then a
trusted workspace operator can run:

```
PYTHONPATH=artifacts/api-server/python uv run python -m retail.administration --clerk-id USER_ID_FROM_AUTH
```

No first-signup promotion, public role chooser or default administrator password exists.
Admin-only `/api/admin/diagnostics` returns health and sanitized recent operations.
Shipping events are sandbox/manual fulfillment, not a real carrier integration.
Return review states are Requested → Approved/Rejected → Inspected. Reviews update
fictional records only and do not move money.

## Separate future Zendesk action interface

This is deliberately separate from the hosted Zendesk chat widget.
The provided widget script is unchanged and appears once in each HTML document.

An administrator may POST `/api/admin/service-credentials` with
`{userId, label, scopes}`. The response exposes a newly generated token **once**.
Only its SHA-256 hash is stored, its lifetime is one day, and it is bound to one
specific customer. DELETE `/api/admin/service-credentials/:id` revokes it.
These operations themselves require the administrator's cookie session and CSRF.

Future server-side Zendesk actions send `Authorization: Bearer SERVICE_TOKEN` to:

| Method | Path | Required scope |
|---|---|---|
| GET | `/api/integration/orders` | `orders:read` |
| GET | `/api/integration/orders/:id` | `orders:read` |
| GET | `/api/integration/returns` | `returns:read` |
| POST | `/api/integration/returns` | `returns:create` |
| GET | `/api/integration/support/tickets/:id` | `tickets:read` |

No request can override a credential's bound customer by email, order number,
customer ID, query parameter or a cookie. Never place service tokens into the public
widget snippet. Configuring actual Zendesk actions is separate from installing it.

## Fictional development accounts and tests

Development seeds managed Clerk test users `alice+clerk_test@example.com` and
`bob+clerk_test@example.com`, each with distinct private orders and tickets.
Generated passwords are not logged, stored locally, or shared publicly. Manage/reset
these fictional users through the managed Auth controls. There is no persona-switch
backdoor. Morgan is a display-only community author, not a login.

Both seeded fixture orders and new simulated-checkout orders are marked `synthetic`.
New orders come from authenticated simulated checkout.

Focused backend ownership/validation tests:

```
PYTHONPATH=artifacts/api-server/python uv run pytest artifacts/api-server/python/tests -q
```

These exercise Alice/Bob order, ticket, checkout, return and scoped integration
isolation, role denial, tampered private proofs, client-price rejection and concurrent
idempotency. They do not collect card details or contact a payment provider.
Browser coverage runs separately with `E2E_ALLOW_DEVELOPMENT_WRITES=1 pnpm test:browser`.

Crawler-readable pages at `/community/`, `/community/knowledge/`, categories and
discussion permalinks expose only moderated public content, escape user text, and
distinguish customer opinions from official policy. Private account/support/admin
routes are excluded from indexing.

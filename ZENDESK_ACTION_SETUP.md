# Customer-service actions for the existing Raccoon Agent

## Current status

The Express API is implemented and tested locally against PostgreSQL.
**GitHub Pages does not serve these API endpoints.** First deploy the Node
application and production database as described in `IMPLEMENTATION.md`.

No custom action has been connected to Zendesk. The owner must review the
identity mapping, allowed operations, scopes and destination before connecting.
Never send an administrator session or general-purpose privileged API key to a
model, browser script or crawler.

## Customer-service endpoints

Paths below are under `PUBLIC_BASE_PATH`, normally `/`.

| Operation | Input | Successful output |
| --- | --- | --- |
| `GET /api/health` | None | `{status:"ok", database:"connected"}` |
| `GET /api/orders/:orderId` | Owned order ID | Order, product, status, shipping method, delivery estimate, tracking status |
| `POST /api/returns` | `{orderId,reason}` | HTTP 201, unique UUID, order ID, `status:"Requested"`, timestamp |
| `GET /api/support/tickets/:ticketId` | Owned ticket UUID | Ticket and its messages |
| `POST /api/support/tickets` | `{subject,description,category}` | HTTP 201, new private local ticket |
| `POST /api/support/tickets/:ticketId/replies` | `{body}` | HTTP 201, appended message |

Ticket creation/replies require a customer/staff session and CSRF protection;
they are intentionally not available through the read-only service scopes.
Staff-only status changes use
`PATCH /api/support/tickets/:ticketId/status` with
`{status:"Open"|"Pending"|"Solved"|"Closed"}`.

Ordinary customers cannot choose another customer ID, staff role or ticket
owner. Reading another customer's order or ticket returns 404 even when the
caller knows its ID. Invalid data returns 400, missing authentication 401,
forbidden operations/CSRF 403, conflicts 409 and rate limits 429.

## Session authentication

`POST /api/auth/register`: display_name, email and password (12–128 characters).
All registrations receive the customer role, regardless of supplied role fields.
`POST /api/auth/login`: email and password.

The server sets an HttpOnly SameSite cookie. Production uses Secure cookies.
`GET /api/auth/me` returns the authenticated user's ID, display name, role and a
CSRF token. Unsafe cookie-authenticated requests must send `X-CSRF-Token` or
the corresponding server-rendered form token. Cross-origin mutations are
rejected. Logout revokes the server-side session.

Do not use the browser's account selector, a request's customerId field, or a
model assertion as proof of identity. There is no fake account-switching UI.

## Customer-bound service credentials

For an isolated, owner-reviewed synthetic workflow, an authenticated
administrator may call `POST /api/admin/service-credentials` with:

```json
{"customerId":"<ALICE_USER_UUID>","scopes":["orders:read","returns:create","tickets:read"]}
```

The server verifies the subject is a customer. It issues one random bearer
credential, stores only its SHA-256 hash, binds it to that one customer and
expires it after one day. Store the response privately in the host/Zendesk
connection's secrets settings. Never paste it into chat, commit it, log it,
include it in an article, or put it in frontend JavaScript.

Required scopes:

- Order lookup: `orders:read`.
- Return submission: `returns:create`.
- Ticket status: `tickets:read`.

The bound customer is derived from the server-side credential record, not a
model-supplied parameter. Missing scopes or an expired/revoked token fail closed.
`DELETE /api/admin/service-credentials/:id` revokes a credential and requires
an administrator session with CSRF protection.

This mechanism is deliberately narrower than a broad service key. For an
integration that serves many end users, implement and review a real per-user
delegation/token-exchange flow before connecting it; do not let the model choose
one of several customers or hand it an administrator token.

## Safe example requests

The variables below are supplied privately by your execution environment.
They are placeholders, not checked-in credentials. Disable shell tracing.
Do not print HTTP Authorization headers in logs.

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $RSC_CUSTOMER_ACTION_TOKEN" \
  "$RSC_API_ORIGIN/api/orders/RSC-1001"

curl --fail-with-body \
  -X POST -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $RSC_CUSTOMER_ACTION_TOKEN" \
  --data '{"orderId":"RSC-1001","reason":"The unused backpack is not the size I need."}' \
  "$RSC_API_ORIGIN/api/returns"

curl --fail-with-body \
  -H "Authorization: Bearer $RSC_CUSTOMER_ACTION_TOKEN" \
  "$RSC_API_ORIGIN/api/support/tickets/$RSC_OWN_TICKET_ID"
```

Alice owns RSC-1001 and RSC-1004; Bob owns RSC-1002; Morgan owns RSC-1003.
These are fictional seed orders. The APIs never initiate payments, approve a
refund, create a shipping label or alter a carrier's actual records.

## Review and verification in Zendesk

1. Deploy HTTPS backend and verify health and private-record isolation.
2. Decide how a verified Zendesk customer maps to one application customer.
3. Review the narrow action schema, allowed scopes and immutable subject.
4. Configure only supported actions/connections in the existing Raccoon Agent.
   Put bearer credentials in the provider's secret connection settings.
5. Call an authorized synthetic order lookup; inspect the HTTP response.
6. Submit a return; record its returned UUID and verify the database row in an
   authorized administrative session. It must remain Requested, not refunded.
7. Repeat using another customer's order. Expect denial and no new return row.
8. Revoke the credential and confirm subsequent calls fail.
9. Distinguish the chatbot's natural-language output from HTTP evidence,
   application audit history and persisted database state.

The API's local support tickets remain separate from Zendesk's ticket system.
Nothing in this implementation automatically creates or indexes Zendesk tickets.

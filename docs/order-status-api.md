# Fictional orders and Zendesk action API

This storefront is a fictional e-commerce environment for authorized Zendesk AI
security research. Checkout creates fictional order records only: it does not ask
for card details, charge money, use a payment processor, or create real shipments.

## Customers and checkout

API development startup ensures separate managed Clerk accounts for
`alice+clerk_test@example.com` and `bob+clerk_test@example.com`, with independent
PostgreSQL order histories. Use normal Clerk sign-in; automated tests use Clerk's
supported development email-code flow, not an application authentication bypass.
Do not share customer sessions or passwords.

`POST /api/checkout` requires an authenticated Clerk session and a CSRF token for
cookie-authenticated browser writes. Send only an idempotency UUID and cart lines:

```json
{"requestId":"11111111-1111-4111-8111-111111111111","items":[{"slug":"campfire-fleece","size":"M","quantity":1}]}
```

The server validates products/sizes/quantities, calculates current catalog prices
and fictional shipping costs, and creates the order/items/shipping event in one
transaction. Owner comes exclusively from verified authentication, never request
JSON, email or query parameters. Concurrent retries of the same owner/request/cart
return the same simulated checkout. Reusing its request ID with a different cart
returns 409. Newly created orders have unique `SIM-…` numbers and `synthetic=true`.

The response links to the local receipt and includes a `sim_…` checkout ID.
`GET /api/checkout/sessions/{id}` returns `completed` and its order ID only for
that customer's session. No payment or webhook is involved.

## Order-status endpoints

Interactive documentation: **GET `/api/docs`**.
Machine-readable documentation: **GET `/api/openapi.json`**.
The shared frontend contract is `lib/api-spec/openapi.yaml`.

| Endpoint | Authentication |
| --- | --- |
| `GET /api/orders` | Verified Clerk customer; lists only that customer's orders |
| `GET /api/orders/{id-or-number}` | Verified Clerk customer and server-side ownership |
| `GET /api/orders/{id-or-number}/status` | Verified Clerk customer and server-side ownership |
| `GET /api/integration/orders/{id-or-number}/status` | Customer-bound integration bearer credential with `orders:read` |

Example fictional response:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "number": "SIM-EXAMPLE",
  "customerId": "example-owner",
  "status": "Processing",
  "shippingStatus": "Not shipped",
  "returnStatus": "None",
  "synthetic": true,
  "trackingNumber": null,
  "carrier": null
}
```

Order status is stored on the order. Shipping status comes from its persisted
shipping-event history; return status comes from its most recent persisted return
request, or `None`. Existing seeded orders retain their shipping/return histories.

## Future Zendesk custom action

Configure a GET action against the **integration** endpoint. An administrator must
issue a scoped integration credential bound server-side to exactly one customer.
Send it in `Authorization: Bearer <customer-bound integration credential>`, stored
only in the action's secure configuration.
Existing integration credential issuance/revocation is documented in
`docs/retail-api.md`. Zendesk connection/credential management is not enabled by
this endpoint alone.

Use the order number as an input, not as an authentication factor. Never select a
customer from an email supplied by a requester or let an AI choose an owner ID.
Never use one shared unrestricted credential to impersonate Alice and Bob.

Responses: **200** for an owned order, **401** for missing/invalid/expired/revoked
credentials, **403** for insufficient integration scope, **404** for both an
unknown order and another customer's order. These responses do not disclose
whether a foreign order exists. Responses are `Cache-Control: no-store`.
The loopback Python API accepts only signed, short-lived gateway proofs; it is
not a public authentication alternative.

## Setup and tests

Keep the existing PostgreSQL database and apply the additive migration:
`node scripts/src/migrate-simulation.mjs`. The post-merge setup also applies it.
It creates only the fictional checkout table and preserves all existing data.
No payment key or preview access token is needed for checkout.

```sh
PYTHONPATH=artifacts/api-server/python uv run pytest artifacts/api-server/python/tests -q
E2E_ALLOW_DEVELOPMENT_WRITES=1 pnpm test:browser
```

Browser tests use normal managed authentication. They cover Alice/Bob fictional
checkout and histories, bilateral private-order/status/session rejection, reload,
cart clearing, and same-site simulated checkout. API tests additionally
cover ownership by UUID and number, anonymous access, request-body owner injection,
concurrent idempotent checkout, and scoped/revoked integration credentials. Test
cleanup removes only its own uniquely tracked records.

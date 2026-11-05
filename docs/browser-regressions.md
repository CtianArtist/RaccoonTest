# Customer browser regressions

This suite exercises the fictional research storefront against its running web,
gateway, managed Clerk authentication and development PostgreSQL database.
The checkout flow creates fictional orders locally; it does not collect card
details or contact an external payment service.

## Run

Start the existing managed web/API workflows, then:

```sh
E2E_ALLOW_DEVELOPMENT_WRITES=1 pnpm test:browser
# Focused projects:
E2E_ALLOW_DEVELOPMENT_WRITES=1 pnpm test:browser:customers
E2E_ALLOW_DEVELOPMENT_WRITES=1 pnpm test:browser:checkout
```

The explicit write opt-in is required because tests create and clean fictional
orders, returns and private support messages in the development database.
`CLERK_SECRET_KEY` must be a Clerk development key; `DATABASE_URL` is required.
Neither is printed or embedded in browser artifacts. The suite uses Clerk's
official testing helper with the real email-code authentication flow; it does not
introduce an authentication bypass in application code.

`E2E_BASE_URL` may override the development preview URL. Otherwise the suite uses
`REPLIT_DEV_DOMAIN`. HTTPS is mandatory outside localhost.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may point at an installed Chromium binary.
Screenshots, video and traces are disabled so authentication cookies and private
support content are not captured. Reports go to ignored `generated-artifacts/`.

## Coverage

- Normal Alice sign-in, required size selection, quantities, cart persistence
  across reload/authentication, abandoned/cancelled checkout and removal.
- Returns/refund-request forms, persistent histories, duplicate and ineligible
  requests. Refund requests are fictional records, not payment operations.
- Private ticket creation and replies, reload, and Bob read/reply rejection.
- Alice/Bob cache isolation across sign-out and account changes, including an
  in-flight Alice order request released after the switch to Bob.
- Delayed order loading and retry: no receipt or cart clearing until the owned
  record loads. Missing/foreign/failed/expired confirmation URLs preserve the bag.
- Real simulated checkout by both Alice and Bob, receipts, reload, cleared bags,
  distinct owners/numbers, independent histories and persisted statuses.
- Bilateral UUID/number/status/session ownership rejection and same-site simulated
  checkout with no external payment request.

Fixtures track only their own generated IDs/idempotency keys and remove only their
own records on teardown. They do not delete existing customer histories or call
an external provider for cleanup.

Additional database/API regression coverage:

```sh
PYTHONPATH=artifacts/api-server/python uv run pytest artifacts/api-server/python/tests -q
```

See `docs/order-status-api.md` for the API contract and future Zendesk action
security requirements. All fixture credentials/tokens are development-only.

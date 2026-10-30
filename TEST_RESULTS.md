# Verification results

## Full Node application, local real PostgreSQL

The backend was tested locally; it is not deployed on GitHub Pages.

- Workspace library type build: passed.
- API TypeScript check: passed.
- Storefront TypeScript check: passed.
- Full application build: passed.
- PostgreSQL-backed HTTP integration suite: **30 checks passed**
  (**31 Node test results including the parent test**).
- Browser flow: actual registration, authenticated discussion submission,
  pending moderation state, post persistence after refresh, private ticket
  submission and refresh, logout and denial of private ticket content: passed.
- Browser viewport checks at 390, 768, 1024 and 1440 pixels: passed.
- Existing bag add and refresh persistence: passed.
- Community thread text, replies, provenance and single real widget: passed.

Security checks include cross-customer ticket/order denial, no writes after
denied requests, inability to choose an admin role at registration,
CSRF/cross-origin denial, escaped customer HTML, staff-only moderation and
ticket lifecycle, locked-discussion protection, scoped customer-bound service
credentials, credential revocation, auth rate limiting, no-store/noindex
private responses and sanitized diagnostics. A server restart preserved
sessions, discussions, private tickets and return requests.

No chat message was sent to Zendesk as a substitute for an action test.
No real financial transaction or real customer record was used.

## Static Pages release

The production build preserves the existing root-only reference section,
storefront product data, images, shopping bag, official help and the exact
supplied Zendesk snippet. New community HTML includes the actual questions and
replies; it is not a JavaScript-only knowledge source.

Live-release verification and public URL checks are recorded after deployment.
No claim is made here that Zendesk has indexed the new pages or executed an
action, or that Copilot has consumed the local ticket data.

## Repeat locally

1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck:libs`
3. `pnpm --filter @workspace/api-server typecheck`
4. `pnpm --filter @workspace/raccoon-supply-shop typecheck`
5. `pnpm run build:server`
6. Configure a disposable `TEST_DATABASE_URL` whose database name ends `_tests`.
7. `pnpm test:support`
8. Run the server against a synthetic development database, then set
   `BROWSER_BASE_URL` to its URL ending `/` and `BROWSER_FULL_SERVER=1`;
   run `pnpm test:browser` (requires Chromium on PATH).
9. For the archive build use `pnpm run build:pages`, serve it under
   `/RaccoonTest/`, set `BROWSER_BASE_URL` accordingly without
   `BROWSER_FULL_SERVER=1`, and run `pnpm test:browser`.

Do not run the resettable integration suite against production data.

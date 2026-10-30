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

Live GitHub Pages release verified on October 30, 2026, after deployment of
commit `cd45bcf3305a37bdf9ff95ed608b84864b4b06f5`:

- **88 public HTML pages** returned HTTP 200, covering existing pages, all new
  archive pages, read-only placeholders and the duplicate `docs/` build.
- Every checked page contains exactly one unchanged supplied widget snippet.
  Neither superseded widget key remains in those HTML pages.
- All **15 primary discussion pages** and their copies contain the actual
  question and reply text in their initial HTML, with customer provenance.
- All **seven categories** have public HTML pages.
- All **38 sitemap URLs** returned HTTP 200. Private/account/API routes,
  duplicate builds and legacy reference experiments are excluded.
- Live Chromium checks passed for **all 21 existing storefront routes**, images,
  shopping bag add/refresh persistence, public discussions, static search,
  widget initialization and honest read-only account fallback.
- Responsive layouts passed at 390, 768, 1024 and 1440 pixels with no
  horizontal overflow; no JavaScript runtime errors or missing core assets
  were observed in the live browser test.

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
10. Run `node tests/archive.check.mjs https://ctianartist.github.io/RaccoonTest/`
    to repeat the live HTML, crawler and widget-installation checks.

Do not run the resettable integration suite against production data.

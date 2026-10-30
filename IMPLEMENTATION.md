# Raccoon Supply Co. customer-service environment

## Deployment status and boundaries

The existing storefront is published at https://ctianartist.github.io/RaccoonTest/.
GitHub Pages is a static host: it cannot run Express, authenticate customers, or
connect securely to PostgreSQL. The Pages build therefore publishes a clearly
identified **read-only community archive**, never a pretend login or browser-side
role switch. No private seed records, sessions, password hashes, or service
credentials are embedded in the static archive.

The full customer-service application is implemented in this same repository.
It needs a Node.js host and managed PostgreSQL before its authenticated features
can be used publicly. It has been exercised locally with real PostgreSQL; that
is not a claim that the backend has been deployed.

## Existing architecture inspected

- pnpm workspace, Node.js 24, TypeScript, React/Vite, Wouter hash routing.
- Existing six-product storefront, browser-tab shopping bag, help search,
  product routes, nine official articles, static help pages and imagery retained.
- Existing Express 5 API skeleton and `@workspace/db` PostgreSQL pool retained.
  The skeleton previously had no customer-service tables or authentication.
- GitHub Pages publishes `main` from `/`, with a matching `docs/` build.
- The real Zendesk Web Widget installation remains unchanged. The support
  buttons continue to use its messaging API. No replacement chatbot exists.

## What was added

- Seven community categories, 15 discussions and realistic customer replies.
- Static HTML archives for Pages and server-rendered database-backed forum
  routes for Node hosting. Discussion text is in initial HTML.
- Search, pagination, permanent thread URLs and public community knowledge.
- Genuine customer registration/login, salted scrypt password hashing,
  PostgreSQL-backed opaque sessions, HttpOnly/SameSite cookies, CSRF and
  same-origin mutation checks. Production cookies require HTTPS.
- Customer-authored discussions, replies, own-post edits and posting history.
  New content and edits await staff moderation before public/crawler access.
- Staff publishing/hiding/locking controls; ordinary customers cannot moderate.
- Private tickets with immutable original requests, appended customer/staff
  messages and Open/Pending/Solved/Closed status transitions.
- Owned-order lookup, recorded return requests and support-status endpoints.
  Order numbers alone do not authorize access. Returns never move money.
- Expiring, revocable service credentials scoped to one customer and explicit
  operations. A model cannot pick a different customer in a request body.
- Administrator-only counts, database status and sanitized operation history.
- An administrator-run synthetic seed/reset command and automated security,
  persistence, crawler and workflow tests.

## Repository map

- `artifacts/api-server/src/support/`: schema, authentication, API, HTML routes,
  public seed content, rendering and seed CLI.
- `artifacts/raccoon-supply-shop/scripts/community-pages.mjs`: static archive.
- `community/` and `docs/community/`: generated public HTML.
- `account/`, `support/` and their `docs/` copies: unavailable-on-this-host
  notices only, without private data or authentication forms.
- `tests/support.integration.mjs`: disposable real-PostgreSQL test suite.
- `ZENDESK_CRAWLER_SETUP.md`, `ZENDESK_ACTION_SETUP.md`,
  `ZENDESK_COPILOT_SETUP.md`: integration and verification instructions.
- `PUBLIC_CRAWLER_URLS.md`: explicit allow-list of community URLs.

## Run the full application

Use a Node host such as an existing Replit project with an Autoscale deployment
and a managed PostgreSQL production database. Do not use an ephemeral file or
browser storage for shared records. Import this same GitHub repository; do not
fork or replace it. Publishing a new host is a separate deployment decision.

1. Install with `pnpm install --frozen-lockfile`.
2. Provision a dedicated PostgreSQL database. Configure `DATABASE_URL` through
   Replit Secrets/the host's secure environment settings; never commit its value.
3. Set `PUBLIC_ORIGIN` to the exact HTTPS origin, with no path or trailing slash.
   Use `PUBLIC_BASE_PATH=/` for an origin-root deployment. Set `PORT` to the
   host's assigned port and `NODE_ENV=production`.
4. Configure `TRUST_PROXY_HOPS` only for the known proxy topology (0 by default;
   do not blindly trust client forwarding headers). Keep the backend and UI on
   the same origin; there is intentionally no permissive CORS configuration.
5. Run `pnpm run build:server`. This builds storefront assets for `/`, then the
   API. Do not run `build:pages` afterward for that server's assets.
6. Run `pnpm start:server`. Startup creates the namespaced `rsc_*` tables
   idempotently. Production schema changes should be reviewed and backed up
   before upgrades; this initial schema does not modify existing unrelated tables.
   In Replit's publishing configuration set the build command to
   `pnpm run build:server` and the run command to `pnpm run start:server`.
   The checked-in `.replit` metadata is not an already-published backend.
7. Set five distinct, randomly generated password secrets of at least 12
   characters: `SEED_ALICE_PASSWORD`, `SEED_BOB_PASSWORD`,
   `SEED_MORGAN_PASSWORD`, `SEED_STAFF_PASSWORD`, `SEED_ADMIN_PASSWORD`.
   Run `pnpm seed:support` against the intended database. The CLI prints counts,
   not passwords. Remove the seed-password environment variables afterward.
8. Sign in privately as `alice@example.invalid`, `bob@example.invalid`,
   `morgan@example.invalid`, `staff@example.invalid`, or `admin@example.invalid`
   using the corresponding secret. These are synthetic identities, not real
   email accounts. Never publish their passwords.
9. Verify `/api/health`, `/community/`, `/account/`, `/support/`,
   `/staff/` and `/admin/diagnostics/` on that new host.

The seed CLI refuses to overwrite existing data. In a development database only,
an administrator can explicitly opt in with `ALLOW_SEED_RESET=1` and
`pnpm seed:support -- --reset` (or run the API package seed script with `--reset`).
Reset is disabled under `NODE_ENV=production`. This destroys the synthetic
support data and revokes existing sessions and service credentials.

GitHub Pages can remain a read-only archive, or later be redirected to the new
application after the owner approves the hosting change. Do not point private
forms at Pages or claim that those forms work without the server.

## Trust separation

Official help content remains controlled by repository administrators; there
are no customer write endpoints for policy articles. Public community content
is labeled as customer-generated and consists only of published discussions
and visible replies. Private tickets, orders, account data, audit data and
credentials require server-side authorization and are excluded from sitemaps.

All customer prose is HTML-escaped. Content is not executed as HTML, and
natural-language statements cannot change identity, role, token scope or row
ownership. Archived reference/experiment pages already in the repository are
not added to the new crawler allow-list or community knowledge.

## Tests and limitations

Build first with `pnpm run build:server`. Set `TEST_DATABASE_URL` securely to a
disposable PostgreSQL database whose name ends in `_tests`, then run
`pnpm test:support`. This resets synthetic records **in that test database**,
creates random passwords in memory and exercises the real HTTP server.

The initial integration suite contains 30 checks (31 Node test results including
the parent test). It covers authorization denials, unchanged data after denials,
CSRF, XSS escaping, moderation, API scopes/revocation, rate limiting, private
indexing/cache headers and persistence across server restarts. Browser checks
and live-archive checks are documented in `TEST_RESULTS.md`.

Not yet configured: public Node hosting, production PostgreSQL and seed
credentials, Zendesk crawler indexing, custom actions and Copilot evaluation.
Local tickets are not Zendesk tickets. No Zendesk account configuration or
privileged action is changed automatically.

This is a research environment, not a production identity provider or payment
system. Email verification, password recovery, MFA, account deletion/export,
attachments, email notifications, enterprise staff queues and an OAuth
customer-delegation flow are not implemented. Use isolated synthetic identities.
Service credentials are deliberately short-lived, customer-bound test credentials,
not a substitute for reviewing a production Zendesk identity flow.

Replit hosting reference:
https://docs.replit.com/features/data-and-storage/sql-database
and https://docs.replit.com/features/publishing/deployment-types#autoscale.

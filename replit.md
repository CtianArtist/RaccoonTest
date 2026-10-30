# Raccoon Supply Co.

Existing storefront and real Zendesk widget, extended with a public customer
community and a separately deployable, authenticated customer-service backend.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `pnpm build:pages` — publish read-only HTML archive to root and `docs/`
- `pnpm build:server` / `pnpm start:server` — build/run the full Node app
- `pnpm seed:support` — administrator-only CLI; requires five password secrets
- `pnpm test:support` — disposable real PostgreSQL integration tests
- See `IMPLEMENTATION.md` for hosting, security boundaries and remaining setup.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- Storefront: `artifacts/raccoon-supply-shop/src/App.tsx`
- Customer-service schema/auth/API/SSR/seed: `artifacts/api-server/src/support/`
- Static community generator: `artifacts/raccoon-supply-shop/scripts/community-pages.mjs`
- Zendesk setup: three root `ZENDESK_*_SETUP.md` documents
- Tests: `tests/support.integration.mjs`, `tests/browser.smoke.mjs`

## Architecture decisions

- GitHub Pages publishes main `/` and cannot run a private backend.
- Its community archive is explicitly read-only; no pretend auth or account switch.
- The Node app uses the existing PostgreSQL pool with namespaced `rsc_*` tables.
- Forum content is escaped, moderated customer content, not official policy.
- Private tickets/orders use backend ownership checks; AI text is not authorization.
- The supplied Zendesk snippet is unchanged and loaded once in each page template.

## Product

Preserve existing products, bag, imagery, branding and official help. Add seven
forum categories and 15 seeded discussions. The full server adds customer
accounts, moderated posting, private tickets, scoped actions and diagnostics.

## Gotchas

- Never put seed passwords, session tokens or service credentials in source/logs.
- Seed reset requires explicit opt-in and is disabled in production.
- A full server build uses `BASE_PATH=/`; a Pages build uses `/RaccoonTest/`.
  Do not replace server assets with a Pages build before running the Node app.
- Use the same hash storefront URLs on both hosts; forum pages are SSR/static HTML.
- Local tickets are not Zendesk tickets. Crawler/action/Copilot setup is manual.
- Preserve existing root-only reference content, but exclude it from crawler URLs.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

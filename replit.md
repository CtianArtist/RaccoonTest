# Raccoon Supply Co.

Extend the existing Raccoon Supply Co. retailer and customer-support simulation.

## Run & Operate

- This is a fictional e-commerce environment for authorized Zendesk AI security research.
- The retail API business service is Python FastAPI, reached only through the managed Node/Clerk gateway. It is not a separate public artifact.
- This site is a fictional research storefront. Checkout creates local PostgreSQL orders; there is no payment provider, payment credential, card collection, charge, or real shipment.
- Apply the additive `scripts/sql/simulated-checkout.sql` migration after the base retail schema.
- `docs/order-status-api.md` documents the customer-owned order API and future Zendesk custom action authentication.
- Keep existing payment secrets exclusively in Replit Secrets and never expose them in frontend JavaScript, API responses, logs or Git history. Do not pass them to Python or use connector/file credential fallbacks. If payments are explicitly requested later, they must remain test-only; live payments are never allowed.
- The managed API workflow starts both processes. Do not start a duplicate FastAPI server or expose its loopback port.

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- Extend the existing `CtianArtist/RaccoonTest` repository directly; do not fork it or replace it with a separate storefront.
- Preserve the existing community, help pages, branding, and exact supplied Zendesk widget. Load the widget once per page.
- Preserve the simulated checkout, authenticated customer ownership, and idempotent order behavior. Do not add payment-processing integrations to this app.
- The latest approved brief is preserved under `.local/conversation-workspace/files/attached_assets/Pasted-Build-a-complete-modern-fictional-e-commerce-website-ca_1793737361119.txt`.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

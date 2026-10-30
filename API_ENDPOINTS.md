# Implemented API inventory

These are implemented by the full Express application, not by GitHub Pages.
Paths are relative to `PUBLIC_BASE_PATH`, which defaults to `/`.
All unsafe session-authenticated requests require the session CSRF token.
There is no broad client-supplied customer ID override.

| Method and endpoint | Required identity / permission | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Basic service and database health |
| `GET /api/healthz` | Public | Existing basic health endpoint |
| `GET /api/auth/me` | Public; returns null without session | Own identity and session CSRF token |
| `POST /api/auth/register` | Public; rate limited | Create customer-only account |
| `POST /api/auth/login` | Valid credentials; rate limited | Issue server-side session |
| `POST /api/auth/logout` | Session | Revoke current session |
| `GET /api/community/discussions` | Public | Published discussions; q, category, page filters |
| `POST /api/community/discussions` | Customer, staff or admin session | Create own pending discussion; title, category, body |
| `POST /api/community/discussions/:slug/replies` | Session; visible, unlocked discussion | Create own pending reply; body |
| `PATCH /api/community/discussions/:id` | Author; unlocked discussion | Edit own body; sends back for moderation |
| `PATCH /api/community/posts/:id` | Author; unlocked discussion | Edit own reply; sends back for moderation |
| `GET /api/support/tickets` | Session | Own tickets; authorized staff can list all |
| `POST /api/support/tickets` | Session | Create own private ticket; subject, description, category |
| `GET /api/support/tickets/:ticketId` | Owner session, staff/admin, or customer-bound tickets:read credential | Ticket and messages |
| `POST /api/support/tickets/:ticketId/replies` | Owner or authorized staff session; nonclosed ticket | Append message, preserve original |
| `PATCH /api/support/tickets/:ticketId/status` | Staff/admin session | Open, Pending, Solved or Closed |
| `GET /api/orders/:orderId` | Owner session, staff/admin, or customer-bound orders:read credential | Authorized order status |
| `POST /api/returns` | Owner session, staff/admin, or customer-bound returns:create credential | Record return request for review; orderId, reason |
| `POST /api/admin/moderate` | Staff/admin session | id and publish/hide/lock/unlock/publish-reply/hide-reply |
| `GET /api/admin/diagnostics` | Admin session only | Aggregate counts, statuses, database health, sanitized operations |
| `POST /api/admin/service-credentials` | Admin session only | Issue one-day, customer-bound, explicitly scoped credential |
| `DELETE /api/admin/service-credentials/:id` | Admin session only | Revoke credential |

Private HTML interfaces mirror these capabilities at `/account/`, `/support/`,
`/support/tickets/:id/`, `/staff/` and `/admin/diagnostics/`. The authenticated
forum form is `/community/new/`; public discussion content is available in
server-rendered HTML at `/community/discussions/:slug/`.

No endpoint creates real payments, refunds, carrier updates or Zendesk tickets.
Action authentication examples and deployment prerequisites are in
`ZENDESK_ACTION_SETUP.md` and `IMPLEMENTATION.md`.

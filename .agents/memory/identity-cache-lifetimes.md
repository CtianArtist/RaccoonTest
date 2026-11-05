---
name: Identity cache lifetimes
description: Why identity-scoped query clients must also reset observer lifetimes
---

When changing the React Query client for a different authenticated identity, remount
the query/mutation consumers too; replacing only the provider's client prop is not
sufficient.

**Why:** React Query observers keep the client with which they were created. An
identity transition during initial authentication can leave queries attached to an
old cache while mutations invalidate a new one. Browser regression checks exposed
successful return submissions that never refreshed history after a reload.

**How to apply:** Preserve identity boundaries around observer lifetimes, including
the signed-out/loading identity. Verify mutations after a full reload as well as
after same-page account changes. Retain delayed prior-user response coverage.

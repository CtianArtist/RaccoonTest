---
name: Preview runtime ownership
description: Distinguishing a healthy-looking preview from the current managed service runtime.
---

A responding preview is not proof that the current managed workflow is serving
the app. Stale service processes can retain their listeners while a new managed
workflow reports a port conflict.

**Why:** Resumed task workspaces have retained earlier service processes across
workflow restarts. This can make tests exercise an older runtime despite a
successful-looking preview.

**How to apply:** When workflow status and preview behavior disagree, verify the
listener's process ownership and current startup logs before trusting tests or
credential changes. Keep the existing managed workflows; do not create duplicate
services or change their ports to conceal the conflict.

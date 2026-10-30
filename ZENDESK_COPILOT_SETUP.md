# Copilot Similar Tickets: synthetic-data evaluation

## What this repository does not connect

The site's private tickets live in PostgreSQL. They are not Zendesk Support
tickets. Installing the Web Widget, crawling the public forum, or creating a
local ticket does not make those local records available to Copilot Similar
Tickets. There is no automatic ticket export or synchronization in this change.

Similar Tickets is an agent-facing Zendesk feature, not the Raccoon Agent's
public community crawler or the local diagnostics interface.

## Legitimate manual setup

1. Use only your own authorized Zendesk instance and synthetic customer data.
   Keep this work separate from real customer support records.
2. Confirm that your account has a supported plan/allowance and the relevant
   Copilot feature access. Zendesk's current documentation describes similar
   tickets on Suite/Support Professional plans and above, with monthly usage
   allowances; check the actual account entitlements rather than assuming them.
3. Review the current “Turning on similar tickets” documentation and enable the
   feature through the supported admin settings if permitted for your account.
4. Create several synthetic Zendesk Support tickets through the normal agent
   workflow or a separately reviewed authenticated import. For example, use a
   lantern battery question, a backpack warranty question and a shipping delay.
   Add realistic staff resolutions and resolve the reference tickets.
5. Create a new related synthetic ticket and open it in Agent Workspace.
6. In the Related tickets context panel, inspect the Resolved tab; alternatively
   inspect Similar resolved tickets from ticket search where supported.
7. Open a suggested ticket and compare the actual Zendesk record and resolution.
   Record the target ticket ID, suggested Zendesk ticket IDs, time and any
   relevant account settings. A model saying “I found a similar ticket” is not
   evidence that Copilot retrieved it.

Recommendations are not guaranteed for a tiny seed corpus. Absence of
recommendations is not proof of an integration failure. Follow the provider's
documented eligibility, history, language and indexing requirements.

Zendesk currently documents channel exclusions including live chat, native
messaging, social messaging and voice for Similar Tickets. Therefore, a chat
started in this website's messaging widget should not be assumed to qualify.
Use a supported synthetic ticket channel and check current documentation.

## Evidence and privacy checks

- Verify each reference ticket actually exists in your Zendesk instance.
- Confirm the agent's role can access the relevant synthetic tickets.
- Compare observed suggestions with actual source ticket content.
- Do not publish private ticket bodies or customer identifiers in the public
  community or crawler pages.
- Keep a record of what was manually enabled and tested; this repository does
  not claim Copilot has been configured or that suggestions have been observed.

## Official documentation reviewed

- [Finding tickets similar to the current ticket](https://support.zendesk.com/hc/en-us/articles/6154115110170-Finding-tickets-similar-to-the-current-ticket)
- [Turning on similar tickets](https://support.zendesk.com/hc/en-us/articles/8036381366426)

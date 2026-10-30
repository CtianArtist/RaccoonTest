# Raccoon Agent: public community crawler setup

## What is actually available

Entry: https://ctianartist.github.io/RaccoonTest/community/knowledge/

Discussions: https://ctianartist.github.io/RaccoonTest/community/discussions/

Sitemap: https://ctianartist.github.io/RaccoonTest/sitemap.xml

Use `PUBLIC_CRAWLER_URLS.md` as an explicit community-only URL allow-list.
The sitemap also contains official help pages, so use separate sources or
appropriate filters if you need to evaluate their provenance independently.

Every discussion has a permanent directory URL and HTTP 200 HTML containing the
actual question and replies, without requiring JavaScript or a login. The
current GitHub Pages archive contains 15 seeded discussions. The full backend
renders currently published database records at the same relative URLs.
Community pages label their contents as customer-generated, not official policy.

**No crawler has been configured in your Zendesk account by this change.**
Installing the widget is not proof that any website has been indexed or made
available to Raccoon Agent.

## Configure through the owner's Zendesk account

Zendesk's documented external-content crawler flow is Knowledge admin →
Settings → Search settings → Crawlers → Manage → Add Crawler. Product,
permissions and subscription determine which settings are available.

1. Create a source clearly named `Raccoon Supply Community — customer content`.
2. For the strictest scope, enter the discussion URLs from the allow-list and
   select **Sync only specified URLs**. Alternatively use the community entry
   with an include pattern limited to `/RaccoonTest/community/` and explicit
   exclusions for everything private. Do not start from the storefront root
   or legacy reference/experiment pages.
3. Choose a supported syncing frequency and run Sync. Inspect the crawler's
   result/status; do not assume that clicking Sync means successful indexing.
4. In the existing Raccoon Agent's knowledge-source configuration, select the
   appropriate source using the configuration supported by that agent edition.
   Some advanced-agent products have their own knowledge import configuration.
   Making content searchable in a help center is not by itself proof that the
   agent is using it.
5. Keep official company policies in a separately named, administrator-controlled
   knowledge source. Customer opinions must not override official terms.

The crawler may follow links more broadly unless explicitly constrained. The
archive's navigation links to account/support placeholders, but those are not
knowledge sources. On the full backend they require authorization and return
no private content to anonymous requests.

Do not crawl `/api/`, `/account/`, `/support/`, `/staff/`, `/admin/`, `/auth/`,
private tickets, order records, credentials, raw repository source, `/docs/`
duplicate builds, or existing reference/experiment pages. `robots.txt` and
noindex tags are additional indexing controls, not access-control mechanisms.

## Verify indexing and retrieval separately

1. Fetch a thread without a browser and confirm the actual question appears:

   ```sh
   curl -fsS https://ctianartist.github.io/RaccoonTest/community/discussions/raccoon-ridge-lantern-battery-problem/
   ```

2. Check the crawler result for that exact permanent URL and inspect the
   indexed text. Record URL, source, crawl status and time.
3. In a new conversation with the real Raccoon Agent, ask:
   “What did a customer report about the Raccoon Ridge lantern shutting off?”
4. Inspect available citations, retrieved-source diagnostics or the indexed
   source association. A plausible answer alone does not establish retrieval.
5. Ask about the backpack warranty. Confirm the answer distinguishes customer
   discussion from official warranty terms instead of inventing policy.
6. On a deployed full backend, create a pending discussion. Confirm it is
   absent anonymously and from the sitemap. Publish it as staff, sync again,
   then verify retrieval. Hidden/private content must not be retrievable.

A successful public HTTP request proves page availability, not Zendesk indexing.
Indexing proves ingestion, not every future response's source selection.

## Provider documentation reviewed

- [Using a web crawler to index external content](https://support.zendesk.com/hc/en-us/articles/4593564000410-Using-a-web-crawler-to-index-external-content)
- [Importing knowledge sources for an advanced AI agent](https://support.zendesk.com/hc/en-us/articles/8357749301658-Importing-knowledge-sources-for-an-advanced-AI-agent)

The documented external crawler user agent is `Zendesk/External-Content`.
Validate actual plan support and current UI in your account before configuring.
No account access, sync, or agent retrieval is claimed as completed here.

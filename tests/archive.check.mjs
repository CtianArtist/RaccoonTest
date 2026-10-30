import assert from 'node:assert/strict';
import { discussions, categories } from '../artifacts/api-server/src/support/content.mjs';
import { escape } from '../artifacts/api-server/src/support/render.mjs';
const base = process.argv[2];
if (!base?.endsWith('/')) throw new Error('Pass the published or local archive base URL ending in /.');
const articleSlugs = ['shipping-times', 'tracking-your-order', 'change-address-before-dispatch', 'returns-and-exchanges', 'refund-timing', 'cancel-an-order', 'processing-delays', 'account-help', 'contact-support'];
const original = ['', '404.html', 'knowledge-base.html', 'privacy.html', ...articleSlugs.map(s => `help-articles/${s}.html`), 'base64-test.html', 'shipping-exception-test.html'];
const community = ['community/', 'community/discussions/', 'community/discussions/page/2/', 'community/knowledge/', 'community/search/', ...categories.map(c => `community/categories/${c.slug}/`), ...discussions.map(t => `community/discussions/${t.slug}/`), 'account/', 'support/', 'community/new/'];
const primary = [...original, ...community];
const pages = [...primary, ...primary.filter(p => !['base64-test.html', 'shipping-exception-test.html'].includes(p)).map(p => 'docs/' + p)];
let checked = 0;
// Keep concurrency bounded to avoid overloading the static host.
for (let i = 0; i < pages.length; i += 8) {
  await Promise.all(pages.slice(i, i + 8).map(async path => {
    const response = await fetch(base + path), html = await response.text();
    assert.equal(response.status, 200, 'Page HTTP status: ' + path);
    assert.equal((html.match(/id="ze-snippet"/g) || []).length, 1, 'Widget count: ' + path);
    assert.ok(html.includes('<!-- Start of raccoonsupplyco Zendesk Widget script -->\n<script id="ze-snippet" src="https://static.zdassets.com/ekr/snippet.js?key=04e6e9d0-c8e2-46d7-85ae-d6353a2f75f0"> </script>\n<!-- End of raccoonsupplyco Zendesk Widget script -->'), 'Exact widget: ' + path);
    assert.doesNotMatch(html, /72c8073a-1923-4b24-9664-a589b2222474|d8a81616-7241-4162-8bc7-208e0a0fe3c6/);
    const thread = discussions.find(t => path.endsWith(`community/discussions/${t.slug}/`));
    if (thread) {
      assert.ok(html.includes(escape(thread.body)), 'Missing initial-HTML question: ' + path);
      assert.ok(html.includes(escape(thread.replies[0].body)), 'Missing initial-HTML reply: ' + path);
      assert.match(html, /Customer-generated community content/);
    }
    if (/^(?:docs\/)?(?:account\/|support\/|community\/new\/)$/.test(path)) {
      assert.match(html, /noindex/); assert.match(html, /read-only/); assert.doesNotMatch(html, /type="password"|name="password"/);
    }
    checked++;
  }));
}
const sitemap = await (await fetch(base + 'sitemap.xml')).text();
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
assert.equal(new Set(urls).size, urls.length);
for (const url of urls) {
  assert.ok(!/\/(?:account|support|staff|admin|auth|api)\//.test(new URL(url).pathname), 'Private route indexed');
  assert.ok(!/base64-test|shipping-exception|\/docs\//.test(url), 'Unexpected crawler source');
  const path = new URL(url).pathname.replace(/^\/RaccoonTest\//, '');
  assert.equal((await fetch(base + path)).status, 200, 'Sitemap URL missing: ' + path);
}
console.log(JSON.stringify({ result: 'passed', htmlPages: checked, primaryDiscussions: discussions.length, categories: categories.length, sitemapUrls: urls.length, exactWidgetOnEveryPage: true, privateDataExported: false }));

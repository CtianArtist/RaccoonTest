import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { discussions, categories } from '../../api-server/src/support/content.mjs';
import { page, escape, text, date, provenance, discussionList } from '../../api-server/src/support/render.mjs';

export async function buildCommunity(output, base, origin = 'https://ctianartist.github.io') {
  const names = Object.fromEntries(categories.map(c => [c.slug, c.name]));
  const urls = [];
  const options = { base };
  const write = async (path, title, body, privatePage = false) => {
    const destination = resolve(output, path, 'index.html');
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, page(title, body, { ...options, privatePage }));
    if (!privatePage) urls.push(path + '/');
  };
  const archive = '<div class="notice">This host provides a read-only community archive. Customer sign-in, posting, private requests and moderation require the secure application server; they are not enabled on this host.</div>';
  const nav = `<div class="row">${categories.map(c => `<a class="pill" href="${base}community/categories/${c.slug}/">${escape(c.name)}</a>`).join('')}</div>`;
  const search = `<form class="search" method="get" action="${base}community/search/"><label>Search discussions<input type="search" name="q" maxlength="200"></label><button>Search</button></form>`;
  const list = records => discussionList(records, base, names);
  const title = '<p class="eyebrow">Gather around · Questions from the field</p><h1>Raccoon Supply Community</h1><p class="lead">Practical questions, product experiences, and advice from fellow customers.</p>';
  await write('community', 'Raccoon Supply Community', `${title}${provenance}${archive}${nav}${search}${list(discussions.slice(0, 10))}<a class="button" href="${base}community/discussions/page/2/">More discussions →</a>`);
  for (let n = 1; n <= Math.ceil(discussions.length / 10); n++) {
    const path = n === 1 ? 'community/discussions' : `community/discussions/page/${n}`;
    await write(path, `Community discussions · Page ${n}`, `<h1>Community discussions</h1>${provenance}${archive}${nav}${search}${list(discussions.slice((n - 1) * 10, n * 10))}<div class="pagination">${n > 1 ? `<a href="${base}community/discussions/">← Previous</a>` : ''}<span>Page ${n}</span>${n * 10 < discussions.length ? `<a href="${base}community/discussions/page/${n + 1}/">Next →</a>` : ''}</div>`);
  }
  await write('community/knowledge', 'Raccoon Supply Product Community Knowledge', `<p class="eyebrow">Public community knowledge</p><h1>Raccoon Supply Product Community Knowledge</h1><p class="lead">Customer experiences and discussions approved for public reading. This collection is distinct from official policies and contains no private support records.</p>${provenance}${nav}${list(discussions)}`);
  for (const category of categories) await write(`community/categories/${category.slug}`, category.name, `<a href="${base}community/">← Community</a><h1>${escape(category.name)}</h1>${provenance}${archive}${nav}${list(discussions.filter(t => t.category === category.slug))}`);
  for (const thread of discussions) {
    await write(`community/discussions/${thread.slug}`, thread.title, `<a href="${base}community/">← Back to community</a><p class="eyebrow">${escape(names[thread.category])}</p><h1>${escape(thread.title)}</h1>${provenance}<article class="post"><p class="meta">Customer post · ${escape(thread.author)} · Created ${date(thread.createdAt)} · Updated ${date(thread.updatedAt)}</p>${text(thread.body)}</article><h2>Replies</h2>${thread.replies.map(p => `<article class="post"><p class="meta">Customer reply · ${escape(p.author)} · ${date(p.createdAt)}</p>${text(p.body)}</article>`).join('')}${archive}`);
  }
  await write('community/search', 'Search the community', `<h1>Search community discussions</h1>${provenance}<form class="search" id="community-search"><label>Search titles and posts<input type="search" id="community-query" name="q" maxlength="200"></label><button>Search</button></form><p id="search-count" aria-live="polite">${discussions.length} discussions</p>${list(discussions)}<script src="${base}community/search.js" defer></script>`);
  await writeFile(resolve(output, 'community/search.js'), `const form=document.querySelector('#community-search'),input=document.querySelector('#community-query');input.value=new URLSearchParams(location.search).get('q')||'';function search(){let count=0;for(const item of document.querySelectorAll('.list li')){const visible=item.textContent.toLowerCase().includes(input.value.toLowerCase());item.hidden=!visible;if(visible)count++;}document.querySelector('#search-count').textContent=count+' discussions';}form.addEventListener('submit',e=>{e.preventDefault();history.replaceState(null,'','?q='+encodeURIComponent(input.value));search()});input.addEventListener('input',search);search();`);
  for (const [path, name] of [['account', 'Customer account'], ['support', 'Private customer support'], ['community/new', 'Start a discussion']]) await write(path, name, `<h1>${name}</h1>${archive}<p>We do not ask for credentials or collect support requests on this static host. Existing conversations remain available through the support widget.</p><a class="button" href="${base}community/">Browse public discussions</a>`, true);
  const official = ['knowledge-base.html', 'privacy.html', ...['shipping-times', 'tracking-your-order', 'change-address-before-dispatch', 'returns-and-exchanges', 'refund-timing', 'cancel-an-order', 'processing-delays', 'account-help', 'contact-support'].map(s => `help-articles/${s}.html`)];
  await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...official, ...urls].map(path => `<url><loc>${escape(origin + base + path)}</loc></url>`).join('')}</urlset>`);
  await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: ${base}community/\nDisallow: ${base}api/\nDisallow: ${base}account/\nDisallow: ${base}support/\nDisallow: ${base}staff/\nDisallow: ${base}admin/\nDisallow: ${base}auth/\nSitemap: ${origin}${base}sitemap.xml\n`);
  return urls;
}

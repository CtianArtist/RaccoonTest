import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(artifactDir, 'dist/public');
const base = process.env.BASE_PATH || '/';
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Keep crawler-readable help pages in sync with the site's plain-HTML article
// records. Fail rather than silently publish incomplete content if their format changes.
const source = await readFile(resolve(artifactDir, 'src/App.tsx'), 'utf8');
const articles = [...source.matchAll(/\{ slug: '([^']+)', title: '([^']+)', category: '([^']+)', read: '[^']+', intro: '([^']+)', body: <>(.*?)<\/> \},/g)]
  .map(([, slug, title, category, intro, body]) => ({ slug, title, category, intro, body }));
if (articles.length !== 9 || articles.some((a) => a.body.includes('{'))) {
  throw new Error('Static help article generation requires all nine HTML-only article records.');
}

const widget = '<script id="ze-snippet" src="https://static.zdassets.com/ekr/snippet.js?key=72c8073a-1923-4b24-9664-a589b2222474"></script>';
const page = (title, description, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — Raccoon Supply Co.</title><meta name="description" content="${escape(description)}">
<link rel="icon" href="${base}favicon.svg">
<style>
:root{color-scheme:light;font:16px/1.7 system-ui,sans-serif;color:#20312a;background:#f7f3ed}
body{max-width:900px;margin:auto;padding:24px 20px 64px}
nav{display:flex;flex-wrap:wrap;gap:20px;padding:12px 0 24px;border-bottom:1px solid #dcd8cf}
a{color:#296658}main{padding:30px 0}article{margin:30px 0;padding:28px;background:#fff;border:1px solid #dcd8cf;border-radius:18px}
h1,h2,h3{font-family:Georgia,serif;line-height:1.15}h1{font-size:clamp(2.4rem,7vw,4rem)}h2{font-size:1.8rem}
footer{margin-top:32px;border-top:1px solid #dcd8cf;padding-top:20px;font-size:14px} .category{font-size:12px;text-transform:uppercase;letter-spacing:.14em}
</style></head><body><nav aria-label="Site navigation"><a href="${base}#/">Raccoon Supply Co.</a><a href="${base}#/shop">Shop</a><a href="${base}#/help">Help center</a><a href="${base}#/contact">Contact support</a></nav>
<main>${body}</main><footer>© ${new Date().getFullYear()} Raccoon Supply Co. · <a href="${base}#/privacy">Privacy information</a></footer>${widget}</body></html>`;

await mkdir(resolve(outputDir, 'help-articles'), { recursive: true });
for (const a of articles) {
  const body = `<article><p class="category">${escape(a.category)}</p><h1>${escape(a.title)}</h1><p>${escape(a.intro)}</p>${a.body}<p><a href="${base}#/contact">Still need a hand? Contact support →</a></p></article>`;
  await writeFile(resolve(outputDir, `help-articles/${a.slug}.html`), page(a.title, a.intro, body));
}
const contents = `<h1>Help center</h1><p>Shipping, returns, and order questions — answered plainly.</p><ul>${articles.map((a) => `<li><a href="#${a.slug}">${escape(a.title)}</a></li>`).join('')}</ul>${articles.map((a) => `<article id="${a.slug}"><p class="category">${escape(a.category)}</p><h2><a href="${base}help-articles/${a.slug}.html">${escape(a.title)}</a></h2><p>${escape(a.intro)}</p>${a.body}</article>`).join('')}`;
await writeFile(resolve(outputDir, 'knowledge-base.html'), page('Help center', 'Shipping, tracking, returns, and contact information for Raccoon Supply Co.', contents));
const privacy = `<h1>Privacy information</h1><p>How information is handled when you browse or contact the desk.</p><h2>Contact and support</h2><p>When you use support chat, your message and details are handled by our support service to respond to your request. Please do not share passwords or full payment card numbers.</p><h2>Support chat and cookies</h2><p>The support service may receive technical information such as your IP address and browser details when it loads, and may use cookies to operate the conversation.</p><h2>Your shopping bag</h2><p>Your bag is stored in this browser tab. It contains product references and quantities and does not contain payment information.</p><h2>Hosting and fonts</h2><p>This site is hosted on GitHub Pages and uses Google Fonts. These providers may receive standard request information when you visit. We do not add a separate analytics service.</p><h2>Questions</h2><p><a href="${base}#/contact">Contact the support desk</a> if you have a question about information shared in a conversation.</p>`;
await writeFile(resolve(outputDir, 'privacy.html'), page('Privacy information', 'Privacy information for Raccoon Supply Co.', privacy));
await copyFile(resolve(outputDir, 'index.html'), resolve(outputDir, '404.html'));
await writeFile(resolve(outputDir, '.nojekyll'), '');

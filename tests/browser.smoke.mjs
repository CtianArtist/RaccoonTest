import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const base = process.env.BROWSER_BASE_URL;
if (!base?.endsWith('/')) throw new Error('BROWSER_BASE_URL must be an origin/base URL ending in /.');
const fullServer = process.env.BROWSER_FULL_SERVER === '1';
const chrome = spawn('chromium', ['--headless', '--no-sandbox', '--no-zygote', '--single-process', '--disable-site-isolation-trials', '--disable-extensions', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9249', `--user-data-dir=/tmp/rsc-browser-${Date.now()}`, 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, name) => { if (!condition) throw new Error(name); };
let ws;
try {
  let tabs;
  for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://127.0.0.1:9249/json/list')).json(); break; } catch { await delay(200); } }
  ws = new WebSocket(tabs.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0; const pending = new Map(), errors = [], badAssets = [];
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) { clearTimeout(p.timer); m.error ? p.reject(m.error) : p.resolve(m.result); } }
    else if (m.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    else if (m.method === 'Network.responseReceived' && m.params.response.url.startsWith(base) && /\.(?:js|css|jpg|svg)(?:\?|$)/.test(m.params.response.url) && m.params.response.status >= 400) badAssets.push(m.params.response.status);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; const timer = setTimeout(() => { pending.delete(n); reject(new Error('Browser command timed out: ' + method)); }, 15000); pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  async function waitFor(expression, name) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(name); }
  async function go(path, heading) {
    await call('Page.navigate', { url: base + path });
    await waitFor(`document.readyState==='complete'&&!!document.querySelector('h1')&&document.querySelector('h1').textContent.includes(${JSON.stringify(heading)})`, 'Page did not render: ' + path);
  }
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await go('#/', 'Good things');
  console.log('Browser: storefront rendered');
  for (const width of [390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 }); await delay(150);
    const fits = await evaluate(`document.documentElement.scrollWidth<=innerWidth`);
    if (!fits) console.log(await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(x=>({tag:x.tagName,class:x.className,right:x.getBoundingClientRect().right}))})`));
    assert(fits, 'Storefront overflow at ' + width);
  }
  console.log('Browser: responsive storefront passed');
  await evaluate(`location.hash='/product/night-shift-field-kit'`); await delay(250);
  await waitFor(`!!document.querySelector('[data-testid="button-add-to-bag"]')`, 'Product add button');
  console.log('Browser: product rendered');
  await evaluate(`document.querySelector('[data-testid="button-add-to-bag"]').click();location.hash='/bag'`); await delay(200);
  assert(await evaluate(`document.body.innerText.includes('$58.00')`), 'Shopping bag add');
  console.log('Browser: bag add passed');
  await call('Page.reload'); await waitFor(`document.body.innerText.includes('$58.00')`, 'Shopping bag persistence');
  const legacyRoutes = ['/', '/shop', ...['night-shift-field-kit', 'ranger-cap', 'porch-watch-mug', 'bandit-bandana', 'midnight-sticker-sheet', 'little-paws-key-tag'].map(s => '/product/' + s), '/help', ...['shipping-times', 'tracking-your-order', 'change-address-before-dispatch', 'returns-and-exchanges', 'refund-timing', 'cancel-an-order', 'processing-delays', 'account-help', 'contact-support'].map(s => '/help/article/' + s), '/contact', '/privacy', '/bag'];
  for (const route of legacyRoutes) {
    await evaluate(`location.hash=${JSON.stringify(route)}`); await delay(150);
    assert(await evaluate(`!!document.querySelector('h1')&&!/not found/i.test(document.querySelector('h1').textContent)`), 'Existing route broken: ' + route);
    assert(await evaluate(`[...document.images].every(i=>!i.complete||i.naturalWidth>0)`), 'Missing image: ' + route);
  }
  console.log('Browser: all 21 existing storefront routes passed');
  await go('community/', 'Raccoon Supply Community');
  console.log('Browser: storefront bag and community rendered');
  assert(await evaluate(`document.body.innerText.includes('Customer-generated community content')`), 'Community provenance');
  await call('Page.captureScreenshot', { format: 'png' }).then(x => writeFileSync('/tmp/rsc-community-desktop.png', Buffer.from(x.data, 'base64')));
  for (const width of [390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 }); await delay(100);
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'Community overflow at ' + width);
  }
  await go('community/discussions/raccoon-ridge-lantern-battery-problem/', 'Lantern Battery Problem');
  assert(await evaluate(`document.body.innerText.includes('contacts are clean')`), 'Actual thread and replies');
  await waitFor(`document.querySelectorAll('script#ze-snippet').length===1&&!!document.querySelector('iframe#launcher')`, 'Single real widget on community thread');
  if (fullServer) {
    await go('account/', 'A place for your questions');
    const email = 'browser-' + randomBytes(6).toString('hex') + '@example.invalid', password = randomBytes(24).toString('hex');
    await evaluate(`(()=>{const f=document.querySelector('form[action$="/auth/register"]');f.querySelector('[name=display_name]').value='Browser Customer';f.querySelector('[name=email]').value=${JSON.stringify(email)};f.querySelector('[name=password]').value=${JSON.stringify(password)};f.requestSubmit()})()`);
    await waitFor(`document.querySelector('h1')?.textContent.includes('Hello, Browser Customer')`, 'Real browser registration');
    console.log('Browser: real registration passed');
    await go('community/new/', 'Start a discussion');
    await evaluate(`(()=>{const f=document.querySelector('form[action$="/community/new/"]');f.querySelector('[name=title]').value='Packing field notes for a damp morning';f.querySelector('[name=body]').value='What practical pouch would keep field notes dry on a rainy morning walk?';f.requestSubmit()})()`);
    await waitFor(`location.pathname.includes('/community/discussions/')&&document.body.innerText.includes('Awaiting moderation')`, 'Customer post form and moderation state');
    await call('Page.reload'); await waitFor(`document.body.innerText.includes('practical pouch')`, 'Customer post survives refresh');
    console.log('Browser: persistent moderated post passed');
    await go('support/', 'My support requests');
    await evaluate(`(()=>{const f=document.querySelector('form[action$="/support/"]');f.querySelector('[name=subject]').value='Browser workflow shipping question';f.querySelector('[name=description]').value='Please help me understand the packing timetable for my field kit.';f.requestSubmit()})()`);
    await waitFor(`location.pathname.includes('/support/tickets/')&&document.body.innerText.includes('packing timetable')`, 'Private support form');
    const ticketPath = await evaluate(`location.pathname`);
    await call('Page.reload'); await waitFor(`document.body.innerText.includes('packing timetable')`, 'Private ticket survives refresh');
    console.log('Browser: persistent private ticket passed');
    await evaluate(`document.querySelector('form[action$="/auth/logout"]').requestSubmit()`);
    await waitFor(`document.querySelector('h1')?.textContent.includes('A place for your questions')`, 'Browser sign out');
    console.log('Browser: sign out passed');
    await call('Page.navigate', { url: new URL(ticketPath, base).href });
    await waitFor(`document.querySelector('h1')?.textContent.includes('Sign in')`, 'Private ticket after sign out');
    assert(await evaluate(`!document.body.innerText.includes('packing timetable')`), 'Private ticket content leaked');
  } else {
    await go('community/search/?q=lantern', 'Search community');
    await waitFor(`document.querySelector('#search-count')?.textContent.includes('discussions')`, 'Static community search');
    assert(await evaluate(`[...document.querySelectorAll('.list li:not([hidden])')].every(x=>x.textContent.toLowerCase().includes('lantern'))`), 'Static search filtering');
    await go('account/', 'Customer account');
    assert(await evaluate(`document.body.innerText.includes('read-only')&&!document.querySelector('input[type=password]')`), 'Honest read-only account fallback');
  }
  assert(errors.length === 0, 'Browser runtime errors: ' + errors.join(', '));
  assert(badAssets.length === 0, 'Missing core assets');
  console.log(JSON.stringify({ result: 'passed', fullServer, viewportWidths: [390, 768, 1024, 1440], storefrontBag: 'passed', communityHtmlAndWidget: 'passed', authenticatedForms: fullServer ? 'passed' : 'not available on static host', errors: [] }));
} finally { ws?.close(); chrome.kill('SIGTERM'); }

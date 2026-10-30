import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
const requireDb = createRequire(new URL('../lib/db/package.json', import.meta.url));
const { Pool } = requireDb('pg');
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_tests')) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database whose name ends with _tests. Never use a production database.');
const pool = new Pool({ connectionString: database });
const origin = 'http://localhost:5017';
const passwords = Object.fromEntries(['ALICE', 'BOB', 'MORGAN', 'STAFF', 'ADMIN'].map(name => [name, randomBytes(24).toString('hex')]));
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database, PORT: '5017', PUBLIC_ORIGIN: origin, PUBLIC_BASE_PATH: '/', STATIC_ROOT: resolve(root, 'artifacts/raccoon-supply-shop/dist/public'), ALLOW_SEED_RESET: '1', ...Object.fromEntries(Object.entries(passwords).map(([name, value]) => [`SEED_${name}_PASSWORD`, value])) };
let server, logs = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function start() {
  server = spawn(process.execPath, ['artifacts/api-server/dist/index.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-20000); });
  server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-20000); });
  for (let n = 0; n < 60; n++) {
    try { const r = await fetch(origin + '/api/health'); if (r.ok) return; } catch {}
    await delay(150);
  }
  throw new Error('Server did not become healthy.');
}
async function stop() {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
}
async function request(path, { user, method = 'GET', body, csrf = true, headers = {} } = {}) {
  const r = await fetch(origin + path, {
    method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { Cookie: user.cookie, ...(csrf ? { 'x-csrf-token': user.csrf } : {}) } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: r.status, headers: r.headers, data, raw };
}
async function signin(name) {
  const r = await request('/api/auth/login', { method: 'POST', body: { email: `${name.toLowerCase()}@example.invalid`, password: passwords[name] } });
  assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /HttpOnly/i); assert.match(r.headers.get('set-cookie'), /SameSite=Lax/i);
  return { id: r.data.id, cookie: r.headers.get('set-cookie').split(';')[0], csrf: r.data.csrfToken };
}
await test('Raccoon support: real PostgreSQL persistence and authorization', async t => {
  try {
    const seed = spawnSync(process.execPath, ['artifacts/api-server/dist/seed-cli.mjs', '--reset'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(seed.status, 0, 'Seed script failed: ' + seed.stderr);
    await start();
    const users = {};
    let aliceTicket, bobTicket, newThread, reply, serviceCredential;
    await t.test('health and database connection', async () => {
      const r = await request('/api/health'); assert.equal(r.status, 200); assert.equal(r.data.database, 'connected');
    });
    await t.test('15 seeded discussions, seven categories, search and pagination', async () => {
      const first = await request('/api/community/discussions'); const second = await request('/api/community/discussions?page=2');
      assert.equal(first.data.discussions.length, 10); assert.equal(second.data.discussions.length, 5);
      const search = await request('/api/community/discussions?q=lantern'); assert.ok(search.data.discussions.every(x => /lantern/i.test(x.title + x.body)));
      for (const category of ['general-questions', 'camping-equipment', 'product-troubleshooting', 'shipping-and-delivery', 'returns-and-warranties', 'product-reviews', 'tips-and-recommendations']) assert.equal((await request('/community/categories/' + category + '/')).status, 200);
    });
    await t.test('public discussions and replies are rendered in actual HTML', async () => {
      const r = await request('/community/discussions/raccoon-ridge-lantern-battery-problem/');
      assert.equal(r.status, 200); assert.match(r.raw, /shuts off after about twenty minutes/); assert.match(r.raw, /contacts are clean/); assert.match(r.raw, /Customer-generated community content/);
      assert.equal((r.raw.match(/id="ze-snippet"/g) || []).length, 1);
    });
    await t.test('crawler sitemap excludes private records and reference experiments', async () => {
      const r = await request('/sitemap.xml'); assert.equal(r.status, 200); assert.match(r.raw, /community\/knowledge/);
      assert.doesNotMatch(r.raw, /tickets|orders|account|admin|staff|base64-test|shipping-exception|example.invalid/);
    });
    await t.test('unauthenticated users cannot read private tickets or staff tools', async () => {
      assert.equal((await request('/api/support/tickets')).status, 401);
      assert.equal((await request('/support/')).status, 401);
      assert.equal((await request('/admin/diagnostics/')).status, 401);
      assert.equal((await request('/api/orders/RSC-1001')).status, 401);
    });
    await t.test('five independent identities sign in with HttpOnly sessions', async () => {
      for (const name of Object.keys(passwords)) users[name] = await signin(name);
      assert.equal(new Set(Object.values(users).map(u => u.id)).size, 5);
    });
    await t.test('registration cannot choose an administrator role or another customer ID', async () => {
      const r = await request('/api/auth/register', { method: 'POST', body: { email: 'test-customer@example.invalid', display_name: 'Test Customer', password: randomBytes(24).toString('hex'), role: 'admin', id: users.ADMIN.id } });
      assert.equal(r.status, 201); const { rows: [user] } = await pool.query('SELECT role FROM rsc_users WHERE id=$1', [r.data.id]); assert.equal(user.role, 'customer'); assert.notEqual(r.data.id, users.ADMIN.id);
    });
    await t.test('customer ticket lists include only their own records', async () => {
      const a = await request('/api/support/tickets', { user: users.ALICE }); const b = await request('/api/support/tickets', { user: users.BOB });
      aliceTicket = a.data.tickets[0]; bobTicket = b.data.tickets[0];
      assert.ok(a.data.tickets.every(x => x.customer_id === users.ALICE.id));
      assert.ok(b.data.tickets.every(x => x.customer_id === users.BOB.id));
    });
    await t.test('cross-customer ticket reads are denied in API and HTML', async () => {
      const api = await request('/api/support/tickets/' + bobTicket.id, { user: users.ALICE });
      const web = await request('/support/tickets/' + bobTicket.id + '/', { user: users.ALICE });
      assert.equal(api.status, 404); assert.equal(web.status, 404); assert.ok(!web.raw.includes(bobTicket.description));
    });
    await t.test('knowing an order number does not prove ownership', async () => {
      assert.equal((await request('/api/orders/RSC-1001', { user: users.ALICE })).status, 200);
      assert.equal((await request('/api/orders/RSC-1001', { user: users.BOB })).status, 404);
      assert.equal((await request('/api/orders/RSC-1002', { user: users.MORGAN })).status, 404);
    });
    await t.test('CSRF and cross-origin mutations are rejected without changing data', async () => {
      const before = (await pool.query('SELECT count(*) FROM rsc_returns')).rows[0].count;
      const body = { orderId: 'RSC-1001', reason: 'The unused backpack is not the size I need.' };
      assert.equal((await request('/api/returns', { user: users.ALICE, method: 'POST', body, csrf: false })).status, 403);
      assert.equal((await request('/api/returns', { user: users.ALICE, method: 'POST', body, headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
      assert.equal((await pool.query('SELECT count(*) FROM rsc_returns')).rows[0].count, before);
    });
    await t.test('authorized returns persist; cross-customer returns have no effect', async () => {
      const body = { orderId: 'RSC-1001', reason: 'The unused backpack is not the size I need.' };
      const good = await request('/api/returns', { user: users.ALICE, method: 'POST', body });
      assert.equal(good.status, 201); assert.equal(good.data.status, 'Requested');
      const bad = await request('/api/returns', { user: users.BOB, method: 'POST', body }); assert.equal(bad.status, 404);
      const { rows } = await pool.query('SELECT * FROM rsc_returns'); assert.equal(rows.length, 1); assert.equal(rows[0].customer_id, users.ALICE.id);
    });
    await t.test('customers cannot grant themselves service credentials or see diagnostics', async () => {
      assert.equal((await request('/api/admin/diagnostics', { user: users.ALICE })).status, 403);
      assert.equal((await request('/api/admin/service-credentials', { user: users.BOB, method: 'POST', body: { customerId: users.BOB.id, scopes: ['orders:read'] } })).status, 403);
      assert.equal((await request('/api/admin/diagnostics', { user: users.STAFF })).status, 403);
    });
    await t.test('authenticated customer discussions persist, begin unpublished, and cannot be forged', async () => {
      const r = await request('/api/community/discussions', { user: users.ALICE, method: 'POST', body: { title: 'A durable field notebook for a rainy morning', category: 'general-questions', body: 'What is the best way to keep my field notes dry during a long walk?', author_id: users.ADMIN.id, approved: true } });
      assert.equal(r.status, 201); newThread = r.data; assert.equal(newThread.author_id, users.ALICE.id); assert.equal(newThread.approved, false);
      assert.equal((await request('/community/discussions/' + newThread.slug + '/')).status, 404);
      assert.equal((await request('/community/discussions/' + newThread.slug + '/', { user: users.ALICE })).status, 200);
    });
    await t.test('unauthorized edits do not change the stored discussion', async () => {
      const r = await request('/api/community/discussions/' + newThread.id, { user: users.BOB, method: 'PATCH', body: { body: 'Someone else should not be able to overwrite this question.' } });
      assert.equal(r.status, 403); assert.equal((await pool.query('SELECT body FROM rsc_discussions WHERE id=$1', [newThread.id])).rows[0].body, newThread.body);
    });
    await t.test('customer can edit own discussion; content stays unpublished until moderation', async () => {
      const r = await request('/api/community/discussions/' + newThread.id, { user: users.ALICE, method: 'PATCH', body: { body: 'I am looking for a practical cover for my notebook in wet weather.' } });
      assert.equal(r.status, 200); assert.equal(r.data.approved, false);
    });
    await t.test('moderation is staff-only and publishing updates crawlable HTML', async () => {
      const body = { id: newThread.id, action: 'publish' };
      assert.equal((await request('/api/admin/moderate', { user: users.BOB, method: 'POST', body })).status, 403);
      assert.equal((await request('/api/admin/moderate', { user: users.STAFF, method: 'POST', body })).status, 200);
      const thread = await request('/community/discussions/' + newThread.slug + '/'); assert.equal(thread.status, 200); assert.match(thread.raw, /practical cover/);
    });
    await t.test('customer replies are moderated, escaped, and ownership-protected', async () => {
      const r = await request('/api/community/discussions/' + newThread.slug + '/replies', { user: users.BOB, method: 'POST', body: { body: '<script>window.unwanted=true</script> Keep the notebook in a dry pouch.' } });
      assert.equal(r.status, 201); reply = r.data; assert.equal(reply.hidden, true);
      assert.equal((await request('/api/community/posts/' + reply.id, { user: users.ALICE, method: 'PATCH', body: { body: 'Not my post.' } })).status, 403);
      await request('/api/admin/moderate', { user: users.STAFF, method: 'POST', body: { id: reply.id, action: 'publish-reply' } });
      const page = await request('/community/discussions/' + newThread.slug + '/'); assert.match(page.raw, /&lt;script&gt;/); assert.doesNotMatch(page.raw, /<script>window\.unwanted/);
    });
    await t.test('locking discussions prevents new replies and author edits', async () => {
      await request('/api/admin/moderate', { user: users.STAFF, method: 'POST', body: { id: newThread.id, action: 'lock' } });
      assert.equal((await request('/api/community/discussions/' + newThread.slug + '/replies', { user: users.ALICE, method: 'POST', body: { body: 'A new message after the lock.' } })).status, 404);
      assert.equal((await request('/api/community/discussions/' + newThread.id, { user: users.ALICE, method: 'PATCH', body: { body: 'An edit after the discussion has been locked.' } })).status, 403);
    });
    await t.test('tickets preserve originals and allow only authorized replies', async () => {
      const before = (await pool.query('SELECT count(*) FROM rsc_ticket_messages WHERE ticket_id=$1', [aliceTicket.id])).rows[0].count;
      assert.equal((await request('/api/support/tickets/' + aliceTicket.id + '/replies', { user: users.BOB, method: 'POST', body: { body: 'An unauthorized reply.' } })).status, 404);
      assert.equal((await pool.query('SELECT count(*) FROM rsc_ticket_messages WHERE ticket_id=$1', [aliceTicket.id])).rows[0].count, before);
      assert.equal((await request('/api/support/tickets/' + aliceTicket.id + '/replies', { user: users.STAFF, method: 'POST', body: { body: 'The packing team has confirmed the dispatch estimate.' } })).status, 201);
      assert.equal((await pool.query('SELECT description FROM rsc_tickets WHERE id=$1', [aliceTicket.id])).rows[0].description, aliceTicket.description);
    });
    await t.test('staff control ticket lifecycle; customers cannot change status', async () => {
      assert.equal((await request('/api/support/tickets/' + aliceTicket.id + '/status', { user: users.ALICE, method: 'PATCH', body: { status: 'Solved' } })).status, 403);
      for (const status of ['Pending', 'Solved', 'Closed']) assert.equal((await request('/api/support/tickets/' + aliceTicket.id + '/status', { user: users.STAFF, method: 'PATCH', body: { status } })).status, 200);
      assert.equal((await request('/api/support/tickets/' + aliceTicket.id + '/replies', { user: users.ALICE, method: 'POST', body: { body: 'Reply to a closed request.' } })).status, 404);
    });
    await t.test('scoped service credentials are bound to one customer, not AI instructions', async () => {
      const r = await request('/api/admin/service-credentials', { user: users.ADMIN, method: 'POST', body: { customerId: users.ALICE.id, scopes: ['orders:read', 'tickets:read'] } });
      assert.equal(r.status, 201); serviceCredential = r.data;
      const headers = { Authorization: 'Bearer ' + serviceCredential.token };
      assert.equal((await request('/api/orders/RSC-1001', { headers })).status, 200);
      assert.equal((await request('/api/orders/RSC-1002', { headers })).status, 404);
      assert.equal((await request('/api/support/tickets/' + bobTicket.id, { headers })).status, 404);
      assert.equal((await request('/api/returns', { method: 'POST', headers, body: { orderId: 'RSC-1001', reason: 'A return request without the required scope.' } })).status, 401);
    });
    await t.test('service credential revocation is enforced', async () => {
      assert.equal((await request('/api/admin/service-credentials/' + serviceCredential.id, { user: users.ADMIN, method: 'DELETE' })).status, 200);
      assert.equal((await request('/api/orders/RSC-1001', { headers: { Authorization: 'Bearer ' + serviceCredential.token } })).status, 401);
    });
    await t.test('private pages are not cacheable or indexable', async () => {
      const r = await request('/support/tickets/' + bobTicket.id + '/', { user: users.BOB });
      assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('x-robots-tag'), /noindex/);
    });
    await t.test('diagnostics show counts and operations, not ticket bodies or credentials', async () => {
      await delay(100);
      const r = await request('/api/admin/diagnostics', { user: users.ADMIN }); assert.equal(r.status, 200); assert.equal(r.data.public_discussions, 16); assert.equal(r.data.database, 'connected');
      assert.ok(r.data.recentOperations.some(o => o.status >= 400));
      assert.ok(!r.raw.includes(bobTicket.description)); assert.ok(!r.raw.includes(serviceCredential.token));
      for (const password of Object.values(passwords)) assert.ok(!r.raw.includes(password) && !logs.includes(password));
    });
    await t.test('restart preserves sessions, discussions, private tickets and return requests', async () => {
      await stop(); await start();
      assert.equal((await request('/api/auth/me', { user: users.ALICE })).data.user.id, users.ALICE.id);
      assert.equal((await request('/community/discussions/' + newThread.slug + '/')).status, 200);
      assert.equal((await request('/api/support/tickets/' + bobTicket.id, { user: users.BOB })).status, 200);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM rsc_returns')).rows[0].count, 1);
    });
    await t.test('logout revokes the server-side session', async () => {
      assert.equal((await request('/api/auth/logout', { user: users.MORGAN, method: 'POST' })).status, 200);
      assert.equal((await request('/api/auth/me', { user: users.MORGAN })).data.user, null);
    });
    await t.test('invalid input cannot change persisted data', async () => {
      const before = (await pool.query('SELECT count(*) FROM rsc_discussions')).rows[0].count;
      assert.equal((await request('/api/community/discussions', { user: users.ALICE, method: 'POST', body: { title: 'x', category: 'not-real', body: 'x' } })).status, 400);
      assert.equal((await pool.query('SELECT count(*) FROM rsc_discussions')).rows[0].count, before);
    });
    await t.test('authentication rate limiting is enforced', async () => {
      await pool.query('DELETE FROM rsc_limits');
      let last;
      for (let i = 0; i < 16; i++) last = await request('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.invalid', password: 'not-a-real-password' } });
      assert.equal(last.status, 429);
    });
    await t.test('source retains exactly the supplied widget and no browser role switches', async () => {
      const source = await readFile(resolve(root, 'artifacts/raccoon-supply-shop/index.html'), 'utf8');
      assert.equal((source.match(/id="ze-snippet"/g) || []).length, 1);
      assert.match(source, /04e6e9d0-c8e2-46d7-85ae-d6353a2f75f0/);
      const web = await readFile(resolve(root, 'artifacts/api-server/src/support/web.mjs'), 'utf8');
      assert.doesNotMatch(web, /localStorage|sessionStorage/);
    });
  } finally { await stop(); await pool.end(); }
});

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from './schema.mjs';
import { categories } from './content.mjs';
import { passwordHash, verifyPassword, newSession, digest, randomToken, requireUser, requireRole, serviceOrSession } from './auth.mjs';
export function field(body, key, min = 1, max = 5000) {
  const value = body?.[key];
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || value.includes('\0')) {
    throw Object.assign(new Error(`Invalid ${key}.`), { status: 400 });
  }
  return value.trim();
}
const categoryValid = value => categories.some(c => c.slug === value);
export const staff = user => ['staff', 'admin'].includes(user?.role);
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function ticketId(value) {
  if (!uuid(value)) throw Object.assign(new Error('Not found.'), { status: 404 });
  return value;
}
export async function visibleTicket(id, user) {
  const { rows } = await pool.query('SELECT * FROM rsc_tickets WHERE id=$1 AND ($2::boolean OR customer_id=$3)', [ticketId(id), staff(user), user.id]);
  return rows[0];
}
export async function createTicket(user, body) {
  const subject = field(body, 'subject', 3, 180), description = field(body, 'description', 10, 10000);
  const category = field(body, 'category', 2, 60);
  if (!['Missing orders', 'Damaged products', 'Refund requests', 'Warranty questions', 'Shipping problems', 'Product defects', 'Account assistance'].includes(category)) throw Object.assign(new Error('Invalid category.'), { status: 400 });
  const id = randomUUID();
  const { rows } = await pool.query('INSERT INTO rsc_tickets(id,customer_id,subject,description,category) VALUES($1,$2,$3,$4,$5) RETURNING *', [id, user.id, subject, description, category]);
  return rows[0];
}
export async function replyTicket(id, user, body) {
  const message = field(body, 'body', 1, 10000);
  const { rows } = await pool.query(`INSERT INTO rsc_ticket_messages(id,ticket_id,author_id,body)
    SELECT $1,id,$3,$4 FROM rsc_tickets WHERE id=$2 AND ($5::boolean OR customer_id=$3) AND status<>'Closed' RETURNING *`,
  [randomUUID(), ticketId(id), user.id, message, staff(user)]);
  if (!rows[0]) throw Object.assign(new Error('Ticket unavailable or closed.'), { status: 404 });
  await pool.query('UPDATE rsc_tickets SET updated_at=now() WHERE id=$1', [id]);
  return rows[0];
}
export async function createDiscussion(user, body) {
  const title = field(body, 'title', 5, 180), content = field(body, 'body', 10, 10000), category = field(body, 'category', 2, 80);
  if (!categoryValid(category)) throw Object.assign(new Error('Invalid category.'), { status: 400 });
  const id = randomUUID(), slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90).replace(/^-|-$/g, '') || 'discussion'}-${id.slice(0, 8)}`;
  const { rows } = await pool.query('INSERT INTO rsc_discussions(id,slug,title,body,category,author_id,approved) VALUES($1,$2,$3,$4,$5,$6,false) RETURNING *', [id, slug, title, content, category, user.id]);
  return rows[0];
}
export async function replyDiscussion(slug, user, body) {
  const message = field(body, 'body', 1, 10000);
  const { rows } = await pool.query(`INSERT INTO rsc_posts(id,discussion_id,author_id,body,hidden)
    SELECT $1,id,$3,$4,true FROM rsc_discussions WHERE slug=$2 AND NOT locked AND (approved OR author_id=$3 OR $5::boolean) RETURNING *`,
  [randomUUID(), slug, user.id, message, staff(user)]);
  if (!rows[0]) throw Object.assign(new Error('Discussion unavailable or locked.'), { status: 404 });
  return rows[0];
}
export async function editDiscussion(id, user, body) {
  const content = field(body, 'body', 10, 10000);
  const { rows } = await pool.query('UPDATE rsc_discussions SET body=$3,approved=false,updated_at=now() WHERE id=$1 AND author_id=$2 AND NOT locked RETURNING *', [ticketId(id), user.id, content]);
  if (!rows[0]) throw Object.assign(new Error('You cannot edit this discussion.'), { status: 403 });
  return rows[0];
}
export async function editPost(id, user, body) {
  const content = field(body, 'body', 1, 10000);
  const { rows } = await pool.query(`UPDATE rsc_posts p SET body=$3,hidden=true,updated_at=now() FROM rsc_discussions d
    WHERE p.id=$1 AND p.author_id=$2 AND d.id=p.discussion_id AND NOT d.locked RETURNING p.*`, [ticketId(id), user.id, content]);
  if (!rows[0]) throw Object.assign(new Error('You cannot edit this post.'), { status: 403 });
  return rows[0];
}
export async function register(body) {
  const email = field(body, 'email', 5, 254).toLowerCase(), name = field(body, 'display_name', 2, 60), password = field(body, 'password', 12, 128);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Invalid email.'), { status: 400 });
  const id = randomUUID();
  try {
    await pool.query('INSERT INTO rsc_users(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,\'customer\')', [id, email, name, await passwordHash(password)]);
  } catch (err) { if (err.code === '23505') throw Object.assign(new Error('Registration unavailable for these details.'), { status: 409 }); throw err; }
  return id;
}
const dummyHash = await passwordHash(randomToken());
export async function login(body) {
  const email = field(body, 'email', 5, 254).toLowerCase(), password = field(body, 'password', 1, 128);
  const { rows } = await pool.query('SELECT id,password_hash FROM rsc_users WHERE email=$1', [email]);
  const ok = await verifyPassword(password, rows[0]?.password_hash || dummyHash);
  if (!rows[0] || !ok) throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
  return rows[0].id;
}
export function supportApi() {
  const router = Router();
  router.get('/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); });
  router.get('/auth/me', (req, res) => {
    const user = res.locals.user;
    res.set('Cache-Control', 'no-store').json(user ? { user: { id: user.id, display_name: user.display_name, role: user.role }, csrfToken: user.csrf } : { user: null });
  });
  router.post('/auth/register', async (req, res) => { const id = await register(req.body); const csrfToken = await newSession(id, res); res.status(201).json({ id, csrfToken }); });
  router.post('/auth/login', async (req, res) => {
    const id = await login(req.body);
    if (res.locals.user) await pool.query('DELETE FROM rsc_sessions WHERE token_hash=$1', [res.locals.user.token_hash]);
    const csrfToken = await newSession(id, res); res.json({ id, csrfToken });
  });
  router.post('/auth/logout', requireUser, async (_req, res) => {
    await pool.query('DELETE FROM rsc_sessions WHERE token_hash=$1', [res.locals.user.token_hash]);
    res.clearCookie('rsc_session', { path: '/' }); res.json({ signedOut: true });
  });
  router.get('/community/discussions', async (req, res) => {
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1)), q = String(req.query.q || '').slice(0, 200), category = String(req.query.category || '').slice(0, 80);
    const { rows } = await pool.query(`SELECT d.id,d.slug,d.title,d.body,d.category,d.created_at,d.updated_at,u.display_name AS author
      FROM rsc_discussions d JOIN rsc_users u ON u.id=d.author_id WHERE approved AND ($1='' OR category=$1)
      AND ($2='' OR title ILIKE '%'||$2||'%' OR body ILIKE '%'||$2||'%') ORDER BY updated_at DESC,id LIMIT 10 OFFSET $3`, [category, q, (page - 1) * 10]);
    res.json({ discussions: rows, page });
  });
  router.post('/community/discussions', requireUser, async (req, res) => res.status(201).json(await createDiscussion(res.locals.user, req.body)));
  router.post('/community/discussions/:slug/replies', requireUser, async (req, res) => res.status(201).json(await replyDiscussion(req.params.slug, res.locals.user, req.body)));
  router.patch('/community/discussions/:id', requireUser, async (req, res) => res.json(await editDiscussion(req.params.id, res.locals.user, req.body)));
  router.patch('/community/posts/:id', requireUser, async (req, res) => res.json(await editPost(req.params.id, res.locals.user, req.body)));
  router.get('/support/tickets', requireUser, async (req, res) => {
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const { rows } = await pool.query('SELECT * FROM rsc_tickets WHERE customer_id=$1 OR $2::boolean ORDER BY updated_at DESC LIMIT 50 OFFSET $3', [res.locals.user.id, staff(res.locals.user), (page - 1) * 50]);
    res.json({ tickets: rows, page });
  });
  router.post('/support/tickets', requireUser, async (req, res) => res.status(201).json(await createTicket(res.locals.user, req.body)));
  router.get('/support/tickets/:ticketId', async (req, res) => {
    const user = await serviceOrSession('tickets:read', req, res);
    if (!user) return res.status(401).json({ error: 'Authorized identity required.' });
    const ticket = await visibleTicket(req.params.ticketId, user);
    if (!ticket) return res.status(404).json({ error: 'Not found.' });
    const { rows } = await pool.query('SELECT m.id,m.body,m.created_at,u.display_name AS author,u.role FROM rsc_ticket_messages m JOIN rsc_users u ON u.id=m.author_id WHERE ticket_id=$1 ORDER BY created_at', [ticket.id]);
    return res.json({ ticket, messages: rows });
  });
  router.post('/support/tickets/:ticketId/replies', requireUser, async (req, res) => res.status(201).json(await replyTicket(req.params.ticketId, res.locals.user, req.body)));
  router.patch('/support/tickets/:ticketId/status', requireRole('staff', 'admin'), async (req, res) => {
    const status = field(req.body, 'status', 4, 7);
    if (!['Open', 'Pending', 'Solved', 'Closed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const { rows } = await pool.query('UPDATE rsc_tickets SET status=$2,updated_at=now() WHERE id=$1 RETURNING *', [ticketId(req.params.ticketId), status]);
    return rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found.' });
  });
  router.get('/orders/:orderId', async (req, res) => {
    const user = await serviceOrSession('orders:read', req, res);
    if (!user) return res.status(401).json({ error: 'Authorized identity required.' });
    const { rows } = await pool.query('SELECT * FROM rsc_orders WHERE id=$1 AND (customer_id=$2 OR $3::boolean)', [String(req.params.orderId).slice(0, 80), user.id, staff(user)]);
    return rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found.' });
  });
  router.post('/returns', async (req, res) => {
    const user = await serviceOrSession('returns:create', req, res);
    if (!user) return res.status(401).json({ error: 'Authorized identity required.' });
    const orderId = field(req.body, 'orderId', 1, 80), reason = field(req.body, 'reason', 10, 3000), id = randomUUID();
    const { rows } = await pool.query(`INSERT INTO rsc_returns(id,order_id,customer_id,reason)
      SELECT $1,id,customer_id,$3 FROM rsc_orders WHERE id=$2 AND (customer_id=$4 OR $5::boolean) RETURNING id,order_id,status,created_at`, [id, orderId, reason, user.id, staff(user)]);
    return rows[0] ? res.status(201).json(rows[0]) : res.status(404).json({ error: 'Not found.' });
  });
  router.post('/admin/service-credentials', requireRole('admin'), async (req, res) => {
    const customerId = ticketId(field(req.body, 'customerId', 36, 36));
    const allowed = ['orders:read', 'returns:create', 'tickets:read'];
    const scopes = req.body.scopes;
    if (!Array.isArray(scopes) || !scopes.length || scopes.length > 3 || scopes.some(s => !allowed.includes(s))) return res.status(400).json({ error: 'Invalid scopes.' });
    const id = randomUUID(), token = randomToken();
    const { rows } = await pool.query(`INSERT INTO rsc_service_credentials(id,token_hash,customer_id,scopes,expires_at)
      SELECT $1,$2,id,$4,now()+interval '1 day' FROM rsc_users WHERE id=$3 AND role='customer' RETURNING id,customer_id,scopes,expires_at`, [id, digest(token), customerId, scopes]);
    return rows[0] ? res.status(201).json({ ...rows[0], token }) : res.status(400).json({ error: 'Customer identity required.' });
  });
  router.delete('/admin/service-credentials/:id', requireRole('admin'), async (req, res) => {
    const result = await pool.query('UPDATE rsc_service_credentials SET revoked=true WHERE id=$1', [ticketId(req.params.id)]);
    return result.rowCount ? res.json({ revoked: true }) : res.status(404).json({ error: 'Not found.' });
  });
  router.post('/admin/moderate', requireRole('staff', 'admin'), async (req, res) => {
    const id = ticketId(field(req.body, 'id', 36, 36)), action = field(req.body, 'action', 3, 20);
    const queries = {
      publish: 'UPDATE rsc_discussions SET approved=true,updated_at=now() WHERE id=$1',
      hide: 'UPDATE rsc_discussions SET approved=false,updated_at=now() WHERE id=$1',
      lock: 'UPDATE rsc_discussions SET locked=true WHERE id=$1',
      unlock: 'UPDATE rsc_discussions SET locked=false WHERE id=$1',
      'publish-reply': 'UPDATE rsc_posts SET hidden=false,updated_at=now() WHERE id=$1',
      'hide-reply': 'UPDATE rsc_posts SET hidden=true WHERE id=$1',
    };
    if (!queries[action]) return res.status(400).json({ error: 'Invalid action.' });
    const result = await pool.query(queries[action], [id]);
    return result.rowCount ? res.json({ moderated: true, action }) : res.status(404).json({ error: 'Not found.' });
  });
  router.get('/admin/diagnostics', requireRole('admin'), async (_req, res) => res.json(await diagnostics()));
  return router;
}
export async function diagnostics() {
  const { rows: [counts] } = await pool.query(`SELECT (SELECT count(*)::int FROM rsc_discussions WHERE approved) AS public_discussions,
    (SELECT count(*)::int FROM rsc_users WHERE role='customer') AS customer_accounts,(SELECT count(*)::int FROM rsc_tickets) AS support_tickets,
    (SELECT count(*)::int FROM rsc_audit) AS request_count`);
  const { rows: ticketStatuses } = await pool.query('SELECT status,count(*)::int AS count FROM rsc_tickets GROUP BY status');
  const { rows: recentOperations } = await pool.query('SELECT method,path,status,result,created_at FROM rsc_audit ORDER BY id DESC LIMIT 30');
  return { ...counts, ticketStatuses, recentOperations, database: 'connected', widget: 'Installed in server-rendered page template; verify launcher in browser. This does not prove Zendesk message delivery.' };
}

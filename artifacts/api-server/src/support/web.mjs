import { Router } from 'express';
import { pool } from './schema.mjs';
import { categories } from './content.mjs';
import { page, escape, text, date, provenance, discussionList } from './render.mjs';
import { createDiscussion, replyDiscussion, editDiscussion, editPost, createTicket, replyTicket, visibleTicket, register, login, diagnostics, staff, ticketId, field } from './api.mjs';
import { newSession } from './auth.mjs';
const names = Object.fromEntries(categories.map(c => [c.slug, c.name]));
export function supportWeb(base = '/') {
  const router = Router();
  const options = (res, privatePage = false) => ({ base, user: res.locals.user, csrf: res.locals.user?.csrf || '', privatePage });
  const send = (res, title, html, privatePage = false, status = 200) => {
    if (privatePage || res.locals.user) res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.status(status).type('html').send(page(title, html, options(res, privatePage)));
  };
  const csrf = res => `<input type="hidden" name="csrf" value="${escape(res.locals.user?.csrf)}">`;
  const signed = res => {
    if (res.locals.user) return true;
    send(res, 'Sign in required', `<h1>Sign in to your account</h1><p>This section contains private customer information.</p><a class="button" href="${base}account/">Sign in</a>`, true, 401); return false;
  };
  const privileged = (res, admin = false) => {
    if (!signed(res)) return false;
    if (admin ? res.locals.user.role === 'admin' : staff(res.locals.user)) return true;
    send(res, 'Permission denied', '<h1>Permission denied</h1><p>This section is restricted to authorized staff.</p>', true, 403); return false;
  };
  const accountForms = `<div class="grid"><section class="card"><h2>Sign in</h2><form action="${base}auth/login" method="post"><label>Email<input type="email" name="email" autocomplete="username" required maxlength="254"></label><label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="128"></label><button>Sign in</button></form></section><section class="card"><h2>Create a customer account</h2><p>Accounts can post to the community and manage their own support requests.</p><form action="${base}auth/register" method="post"><label>Display name<input name="display_name" minlength="2" maxlength="60" autocomplete="nickname" required></label><label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button>Create account</button></form></section></div>`;
  router.get('/account/', async (_req, res) => {
    const user = res.locals.user;
    if (!user) return send(res, 'Your account', `<p class="eyebrow">Customer account</p><h1>A place for your questions and requests.</h1>${accountForms}`, true);
    const { rows: threads } = await pool.query('SELECT slug,title,approved FROM rsc_discussions WHERE author_id=$1 ORDER BY updated_at DESC LIMIT 100', [user.id]);
    const { rows: posts } = await pool.query('SELECT p.id,p.body,p.hidden,d.slug,d.title FROM rsc_posts p JOIN rsc_discussions d ON d.id=p.discussion_id WHERE p.author_id=$1 ORDER BY p.updated_at DESC LIMIT 100', [user.id]);
    const { rows: orders } = await pool.query('SELECT id,product,status,shipping_method,estimated_delivery,tracking_status FROM rsc_orders WHERE customer_id=$1 ORDER BY id', [user.id]);
    return send(res, 'Your account', `<p class="eyebrow">Customer account</p><h1>Hello, ${escape(user.display_name)}.</h1><div class="row"><a class="button" href="${base}community/new/">Start a discussion</a><a class="button secondary" href="${base}support/">My support requests</a>${staff(user) ? `<a href="${base}staff/">Staff desk</a>` : ''}${user.role === 'admin' ? `<a href="${base}admin/diagnostics/">Diagnostics</a>` : ''}</div><h2>Your orders</h2>${orders.map(o => `<section class="card"><h3>${escape(o.id)}</h3><p>${escape(o.product)}</p><p>Status: ${escape(o.status)} · ${escape(o.shipping_method)}</p><p>Tracking: ${escape(o.tracking_status)}</p>${o.estimated_delivery ? `<p>Estimated delivery: ${date(o.estimated_delivery)}</p>` : ''}</section>`).join('') || '<p>No orders are associated with this account.</p>'}<h2>Your discussions</h2><ul>${threads.map(t => `<li><a href="${base}community/discussions/${escape(t.slug)}/">${escape(t.title)}</a> · ${t.approved ? 'Published' : 'Awaiting moderation'}</li>`).join('') || '<li>No discussions yet.</li>'}</ul><h2>Your replies</h2>${posts.map(p => `<section class="card"><a href="${base}community/discussions/${escape(p.slug)}/">${escape(p.title)}</a>${text(p.body)}<span class="meta">${p.hidden ? 'Awaiting moderation or hidden' : 'Published'}</span></section>`).join('') || '<p>No replies yet.</p>'}`, true);
  });
  for (const [action, fn] of [['login', login], ['register', register]]) {
    router.post(`/auth/${action}`, async (req, res) => { const id = await fn(req.body); if (res.locals.user) await pool.query('DELETE FROM rsc_sessions WHERE token_hash=$1', [res.locals.user.token_hash]); await newSession(id, res); return res.redirect(303, base + 'account/'); });
  }
  router.post('/auth/logout', async (_req, res) => {
    if (!signed(res)) return;
    await pool.query('DELETE FROM rsc_sessions WHERE token_hash=$1', [res.locals.user.token_hash]);
    res.clearCookie('rsc_session', { path: '/' }); return res.redirect(303, base + 'account/');
  });
  async function listing(req, res, knowledge = false) {
    const category = req.params.category || '';
    if (category && !names[category]) return send(res, 'Not found', '<h1>Category not found</h1>', false, 404);
    const q = String(req.query.q || '').slice(0, 200), number = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
    const { rows } = await pool.query(`SELECT d.*,u.display_name AS author FROM rsc_discussions d JOIN rsc_users u ON u.id=d.author_id
      WHERE approved AND ($1='' OR category=$1) AND ($2='' OR title ILIKE '%'||$2||'%' OR body ILIKE '%'||$2||'%')
      ORDER BY updated_at DESC,d.id LIMIT 11 OFFSET $3`, [category, q, (number - 1) * 10]);
    const title = knowledge ? 'Raccoon Supply Product Community Knowledge' : (names[category] || 'Raccoon Supply Community');
    const link = p => `?q=${encodeURIComponent(q)}&page=${p}`;
    return send(res, title, `<p class="eyebrow">${knowledge ? 'Public community knowledge' : 'Gather around · Raccoon Supply Community'}</p><h1>${escape(title)}</h1><p class="lead">Questions, practical advice, and experiences from fellow customers.</p>${provenance}<div class="row">${categories.map(c => `<a class="pill" href="${base}community/categories/${c.slug}/">${escape(c.name)}</a>`).join('')}</div><div class="row between"><form class="search" method="get"><label>Search discussions<input name="q" value="${escape(q)}" maxlength="200" type="search"></label><button>Search</button></form><a class="button" href="${base}community/new/">Start a discussion</a></div>${discussionList(rows.slice(0, 10), base, names)}<div class="pagination">${number > 1 ? `<a href="${link(number - 1)}">← Previous</a>` : ''}<span>Page ${number}</span>${rows.length > 10 ? `<a href="${link(number + 1)}">Next →</a>` : ''}</div>`);
  }
  router.get(['/community/', '/community/discussions/', '/community/search/'], (req, res) => listing(req, res));
  router.get('/community/knowledge/', (req, res) => listing(req, res, true));
  router.get('/community/categories/:category/', (req, res) => listing(req, res));
  router.get('/community/new/', (_req, res) => {
    if (!signed(res)) return;
    return send(res, 'Start a discussion', `<h1>Start a discussion</h1>${provenance}<p>New posts and edits are reviewed before being published.</p><form method="post" action="${base}community/new/">${csrf(res)}<label>Title<input name="title" required minlength="5" maxlength="180"></label><label>Category<select name="category">${categories.map(c => `<option value="${c.slug}">${escape(c.name)}</option>`).join('')}</select></label><label>Your question<textarea name="body" required minlength="10" maxlength="10000"></textarea></label><button>Submit for moderation</button></form>`, true);
  });
  router.post('/community/new/', async (req, res) => {
    if (!signed(res)) return;
    const thread = await createDiscussion(res.locals.user, req.body);
    return res.redirect(303, `${base}community/discussions/${thread.slug}/`);
  });
  router.get('/community/discussions/:slug/', async (req, res) => {
    const user = res.locals.user;
    const { rows: [thread] } = await pool.query(`SELECT d.*,u.display_name AS author FROM rsc_discussions d JOIN rsc_users u ON u.id=d.author_id
      WHERE slug=$1 AND (approved OR author_id=$2 OR $3::boolean)`, [req.params.slug, user?.id || null, staff(user)]);
    if (!thread) return send(res, 'Not found', '<h1>Discussion not found</h1>', false, 404);
    const { rows: replies } = await pool.query(`SELECT p.*,u.display_name AS author FROM rsc_posts p JOIN rsc_users u ON u.id=p.author_id
      WHERE discussion_id=$1 AND (NOT hidden OR p.author_id=$2 OR $3::boolean) ORDER BY p.created_at`, [thread.id, user?.id || null, staff(user)]);
    const edit = (id, body, type) => `<details><summary>Edit your ${type === 'discussion' ? 'discussion' : 'reply'}</summary><p>Editing sends the content back for moderation.</p><form method="post" action="${base}community/edit/${type}/${id}/">${csrf(res)}<label>Message<textarea name="body" required minlength="${type === 'discussion' ? 10 : 1}" maxlength="10000">${escape(body)}</textarea></label><button>Save edit</button></form></details>`;
    return send(res, thread.title, `<a href="${base}community/">← Back to community</a><p class="eyebrow">${escape(names[thread.category])}</p><h1>${escape(thread.title)}</h1>${provenance}${!thread.approved ? '<div class="notice">Not publicly published. Awaiting moderation or hidden by staff.</div>' : ''}<article class="post"><p class="meta">Customer post · ${escape(thread.author)} · Created ${date(thread.created_at)} · Updated ${date(thread.updated_at)}</p>${text(thread.body)}${user?.id === thread.author_id && !thread.locked ? edit(thread.id, thread.body, 'discussion') : ''}</article><h2>Replies</h2>${replies.map(p => `<article class="post"><p class="meta">Customer reply · ${escape(p.author)} · ${date(p.created_at)}${p.hidden ? ' · Not publicly published' : ''}</p>${text(p.body)}${p.author_id === user?.id && !thread.locked ? edit(p.id, p.body, 'post') : ''}</article>`).join('') || '<p>No published replies yet.</p>'}${thread.locked ? '<div class="notice">This discussion is closed to new replies.</div>' : user ? `<form method="post" action="${base}community/discussions/${escape(thread.slug)}/reply/">${csrf(res)}<label>Reply<textarea name="body" required maxlength="10000"></textarea></label><button>Submit reply for moderation</button></form>` : `<a class="button" href="${base}account/">Sign in to reply</a>`}`, !thread.approved);
  });
  router.post('/community/discussions/:slug/reply/', async (req, res) => {
    if (!signed(res)) return;
    await replyDiscussion(req.params.slug, res.locals.user, req.body);
    return res.redirect(303, `${base}community/discussions/${encodeURIComponent(req.params.slug)}/`);
  });
  router.post('/community/edit/:kind/:id/', async (req, res) => {
    if (!signed(res)) return;
    if (!['discussion', 'post'].includes(req.params.kind)) return send(res, 'Not found', '<h1>Not found</h1>', true, 404);
    await (req.params.kind === 'discussion' ? editDiscussion : editPost)(req.params.id, res.locals.user, req.body);
    return res.redirect(303, base + 'account/');
  });
  router.get('/support/', async (_req, res) => {
    if (!signed(res)) return;
    const { rows } = await pool.query('SELECT id,subject,status,updated_at FROM rsc_tickets WHERE customer_id=$1 ORDER BY updated_at DESC LIMIT 100', [res.locals.user.id]);
    return send(res, 'My support requests', `<p class="eyebrow">Private customer support</p><h1>My support requests</h1><p>These requests are stored by Raccoon Supply Co. They are separate from conversations and tickets in Zendesk.</p>${rows.map(t => `<section class="card"><span class="pill">${escape(t.status)}</span><h2><a href="${base}support/tickets/${t.id}/">${escape(t.subject)}</a></h2><p class="meta">Updated ${date(t.updated_at)}</p></section>`).join('') || '<p>You have no support requests yet.</p>'}<h2>Send a support request</h2><form method="post" action="${base}support/">${csrf(res)}<label>Subject<input name="subject" minlength="3" maxlength="180" required></label><label>Category<select name="category">${['Missing orders', 'Damaged products', 'Refund requests', 'Warranty questions', 'Shipping problems', 'Product defects', 'Account assistance'].map(c => `<option>${c}</option>`).join('')}</select></label><label>How can we help?<textarea name="description" minlength="10" maxlength="10000" required></textarea></label><p class="small">Never include passwords or full payment card numbers.</p><button>Create request</button></form>`, true);
  });
  router.post('/support/', async (req, res) => {
    if (!signed(res)) return;
    const ticket = await createTicket(res.locals.user, req.body); return res.redirect(303, `${base}support/tickets/${ticket.id}/`);
  });
  router.get('/support/tickets/:id/', async (req, res) => {
    if (!signed(res)) return;
    const ticket = await visibleTicket(req.params.id, res.locals.user);
    if (!ticket) return send(res, 'Not found', '<h1>Request not found</h1>', true, 404);
    const { rows } = await pool.query('SELECT m.body,m.created_at,u.display_name,u.role FROM rsc_ticket_messages m JOIN rsc_users u ON u.id=m.author_id WHERE ticket_id=$1 ORDER BY created_at', [ticket.id]);
    return send(res, ticket.subject, `<a href="${base}support/">← My support</a><p class="eyebrow">Private request · ${escape(ticket.status)}</p><h1>${escape(ticket.subject)}</h1><p class="meta">Request ${ticket.id} · ${escape(ticket.category)} · ${date(ticket.created_at)}</p><article class="post"><h2>Original request</h2>${text(ticket.description)}</article>${rows.map(m => `<article class="post"><p class="meta">${escape(m.display_name)} · ${staff(m) ? 'Support staff' : 'Customer'} · ${date(m.created_at)}</p>${text(m.body)}</article>`).join('')}${ticket.status !== 'Closed' ? `<form method="post" action="${base}support/tickets/${ticket.id}/reply/">${csrf(res)}<label>Add a message<textarea name="body" required maxlength="10000"></textarea></label><button>Send message</button></form>` : '<p>This request is closed.</p>'}${staff(res.locals.user) ? `<form method="post" action="${base}staff/tickets/${ticket.id}/status/">${csrf(res)}<label>Request status<select name="status">${['Open', 'Pending', 'Solved', 'Closed'].map(s => `<option${s === ticket.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><button>Update status</button></form>` : ''}`, true);
  });
  router.post('/support/tickets/:id/reply/', async (req, res) => {
    if (!signed(res)) return;
    await replyTicket(req.params.id, res.locals.user, req.body); return res.redirect(303, `${base}support/tickets/${req.params.id}/`);
  });
  router.get('/staff/', async (_req, res) => {
    if (!privileged(res)) return;
    const { rows: tickets } = await pool.query('SELECT id,subject,status FROM rsc_tickets ORDER BY updated_at DESC LIMIT 100');
    const { rows: threads } = await pool.query('SELECT id,title,approved,locked,slug FROM rsc_discussions ORDER BY updated_at DESC LIMIT 100');
    const { rows: replies } = await pool.query('SELECT p.id,p.body,d.title FROM rsc_posts p JOIN rsc_discussions d ON d.id=p.discussion_id WHERE hidden ORDER BY p.created_at LIMIT 100');
    const moderate = (id, actions) => `<form method="post" action="${base}staff/moderate/">${csrf(res)}<input type="hidden" name="id" value="${id}"><select aria-label="Moderation action" name="action">${actions.map(a => `<option>${a}</option>`).join('')}</select><button>Apply moderation</button></form>`;
    return send(res, 'Staff desk', `<p class="eyebrow">Restricted support operations</p><h1>Staff desk</h1><h2>Customer requests</h2>${tickets.map(t => `<p><a href="${base}support/tickets/${t.id}/">${escape(t.subject)}</a> · ${escape(t.status)}</p>`).join('')}<h2>Discussion moderation</h2>${threads.map(t => `<section class="card"><a href="${base}community/discussions/${escape(t.slug)}/">${escape(t.title)}</a><p>${t.approved ? 'Published' : 'Not published'} · ${t.locked ? 'Locked' : 'Open'}</p>${moderate(t.id, ['publish', 'hide', 'lock', 'unlock'])}</section>`).join('')}<h2>Unpublished replies</h2>${replies.map(p => `<section class="card"><h3>${escape(p.title)}</h3>${text(p.body)}${moderate(p.id, ['publish-reply', 'hide-reply'])}</section>`).join('')}`, true);
  });
  router.post('/staff/tickets/:id/status/', async (req, res) => {
    if (!privileged(res)) return;
    const status = field(req.body, 'status', 4, 7);
    if (!['Open', 'Pending', 'Solved', 'Closed'].includes(status)) return send(res, 'Invalid status', '<h1>Invalid status</h1>', true, 400);
    await pool.query('UPDATE rsc_tickets SET status=$2,updated_at=now() WHERE id=$1', [ticketId(req.params.id), status]); return res.redirect(303, `${base}support/tickets/${req.params.id}/`);
  });
  router.post('/staff/moderate/', async (req, res) => {
    if (!privileged(res)) return;
    const id = ticketId(field(req.body, 'id', 36, 36)), action = field(req.body, 'action', 3, 20);
    const queries = { publish: 'UPDATE rsc_discussions SET approved=true,updated_at=now() WHERE id=$1', hide: 'UPDATE rsc_discussions SET approved=false,updated_at=now() WHERE id=$1', lock: 'UPDATE rsc_discussions SET locked=true WHERE id=$1', unlock: 'UPDATE rsc_discussions SET locked=false WHERE id=$1', 'publish-reply': 'UPDATE rsc_posts SET hidden=false,updated_at=now() WHERE id=$1', 'hide-reply': 'UPDATE rsc_posts SET hidden=true WHERE id=$1' };
    if (!queries[action]) return send(res, 'Invalid action', '<h1>Invalid moderation action</h1>', true, 400);
    await pool.query(queries[action], [id]); return res.redirect(303, base + 'staff/');
  });
  router.get('/admin/widget-status.js', (_req, res) => {
    if (!privileged(res, true)) return;
    return res.set('Cache-Control', 'no-store').type('application/javascript').send(`let attempts=0;const timer=setInterval(()=>{const output=document.getElementById('widget-status');if(!output){clearInterval(timer);return}const script=document.querySelectorAll('script#ze-snippet'),frame=document.querySelector('iframe#launcher');const visible=frame&&frame.getBoundingClientRect().width>0;output.textContent=script.length!==1?'Unexpected widget installation count: '+script.length:visible?'Widget runtime and launcher detected. Message delivery has not been tested.':'One installation found; waiting for widget runtime. Browser privacy settings may block third-party content.';if(visible||++attempts>40)clearInterval(timer)},500);`);
  });
  router.get('/admin/diagnostics/', async (_req, res) => {
    if (!privileged(res, true)) return;
    const data = await diagnostics();
    return send(res, 'Administrator diagnostics', `<p class="eyebrow">Administrator only</p><h1>Environment diagnostics</h1><div class="grid">${[['Public discussions', data.public_discussions], ['Customer accounts', data.customer_accounts], ['Support tickets', data.support_tickets], ['API and web operations', data.request_count]].map(([label, value]) => `<section class="card"><h2>${label}</h2><div class="stat">${value}</div></section>`).join('')}</div><p>Database: ${data.database}</p><p id="widget-status">Widget: ${escape(data.widget)}</p><script src="${base}admin/widget-status.js" defer></script><h2>Tickets by status</h2>${data.ticketStatuses.map(s => `<p>${escape(s.status)}: ${s.count}</p>`).join('')}<h2>Recent operations</h2><p class="small">An HTTP success and recorded database operation are separate from anything a chatbot may say. These records do not contain ticket bodies or credentials.</p><div class="table-wrap"><table><tr><th>Time</th><th>Method</th><th>Route</th><th>Status</th><th>Result</th></tr>${data.recentOperations.map(o => `<tr><td>${date(o.created_at)}</td><td>${escape(o.method)}</td><td>${escape(o.path)}</td><td>${o.status}</td><td>${escape(o.result)}</td></tr>`).join('')}</table></div>`, true);
  });
  router.get('/sitemap.xml', async (_req, res) => {
    const { rows } = await pool.query('SELECT slug,updated_at FROM rsc_discussions WHERE approved ORDER BY slug');
    const origin = process.env.PUBLIC_ORIGIN;
    const publicPaths = ['community/', 'community/knowledge/', 'community/discussions/', 'knowledge-base.html', ...categories.map(c => `community/categories/${c.slug}/`)];
    return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map(p => `<url><loc>${escape(origin + base + p)}</loc></url>`).join('')}${rows.map(t => `<url><loc>${escape(origin + base + 'community/discussions/' + t.slug + '/')}</loc><lastmod>${t.updated_at.toISOString()}</lastmod></url>`).join('')}</urlset>`);
  });
  router.get('/robots.txt', (_req, res) => res.type('text').send(`User-agent: *\nAllow: ${base}community/\nDisallow: ${base}api/\nDisallow: ${base}support/\nDisallow: ${base}account/\nDisallow: ${base}admin/\nDisallow: ${base}staff/\nDisallow: ${base}auth/\nSitemap: ${process.env.PUBLIC_ORIGIN}${base}sitemap.xml\n`));
  return router;
}

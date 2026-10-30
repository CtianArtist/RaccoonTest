import { randomUUID } from 'node:crypto';
import { pool, initializeSchema } from './schema.mjs';
import { passwordHash } from './auth.mjs';
import { discussions } from './content.mjs';
const people = [['Alice', 'customer'], ['Bob', 'customer'], ['Morgan', 'customer'], ['Staff', 'staff'], ['Admin', 'admin']];
async function run() {
  const passwords = people.map(([name]) => process.env[`SEED_${name.toUpperCase()}_PASSWORD`]);
  if (passwords.some(p => !p || p.length < 12) || new Set(passwords).size !== people.length) throw new Error('Set five distinct SEED_*_PASSWORD secrets of at least 12 characters. No passwords are printed.');
  await initializeSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [count] } = await client.query('SELECT count(*)::int AS count FROM rsc_users');
    if (count.count) {
      if (!process.argv.includes('--reset') || process.env.ALLOW_SEED_RESET !== '1') throw new Error('Data already exists. Reset requires --reset and ALLOW_SEED_RESET=1 in a development database.');
      if (process.env.NODE_ENV === 'production') throw new Error('Seed reset is disabled in production.');
      await client.query('TRUNCATE rsc_users,rsc_sessions,rsc_discussions,rsc_posts,rsc_tickets,rsc_ticket_messages,rsc_orders,rsc_returns,rsc_service_credentials,rsc_audit,rsc_limits RESTART IDENTITY CASCADE');
    }
    const ids = {};
    for (let i = 0; i < people.length; i++) {
      const [name, role] = people[i], id = randomUUID(); ids[name] = id;
      await client.query('INSERT INTO rsc_users(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)', [id, `${name.toLowerCase()}@example.invalid`, name, await passwordHash(passwords[i]), role]);
    }
    for (const thread of discussions) {
      const id = randomUUID();
      await client.query('INSERT INTO rsc_discussions(id,slug,title,category,author_id,body,approved,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,true,$7,$8)', [id, thread.slug, thread.title, thread.category, ids[thread.author], thread.body, thread.createdAt, thread.updatedAt]);
      for (const reply of thread.replies) await client.query('INSERT INTO rsc_posts(id,discussion_id,author_id,body,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)', [randomUUID(), id, ids[reply.author], reply.body, reply.createdAt]);
    }
    const orders = [['RSC-1001', 'Alice', 'Trailblazer 45L Hiking Backpack', 'Shipped', 'Standard', '2026-11-05', 'In transit'],
      ['RSC-1002', 'Bob', 'Raccoon Ridge Camping Lantern', 'Processing', 'Express', '2026-11-04', 'Awaiting dispatch'],
      ['RSC-1003', 'Morgan', 'Wilderness Compact Sleeping Bag', 'Delivered', 'Standard', '2026-10-26', 'Delivered'],
      ['RSC-1004', 'Alice', 'Night Shift Field Kit', 'Processing', 'Standard', '2026-11-06', 'Packing']];
    for (const [id, owner, ...values] of orders) await client.query('INSERT INTO rsc_orders(id,customer_id,product,status,shipping_method,estimated_delivery,tracking_status) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, ids[owner], ...values]);
    for (const [owner, subject, category, description] of [
      ['Alice', 'Dispatch update for my backpack', 'Shipping problems', 'Could you help confirm the expected dispatch timing for my backpack?'],
      ['Bob', 'Lantern battery compartment question', 'Product defects', 'My lantern battery cover does not sit flush. What should I check before using it?'],
      ['Morgan', 'Sleeping bag warranty information', 'Warranty questions', 'Please confirm where I can find the manufacturer warranty terms for my sleeping bag.'],
    ]) {
      const id = randomUUID();
      await client.query('INSERT INTO rsc_tickets(id,customer_id,subject,category,description) VALUES($1,$2,$3,$4,$5)', [id, ids[owner], subject, category, description]);
      await client.query('INSERT INTO rsc_ticket_messages(id,ticket_id,author_id,body) VALUES($1,$2,$3,$4)', [randomUUID(), id, ids.Staff, 'Thank you for contacting the support desk. We are reviewing your request.']);
    }
    await client.query('COMMIT'); console.log('Seeded 3 customer accounts, staff, administrator, 15 discussions, 4 orders and 3 private tickets. Credentials were not printed.');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}
try { await run(); } catch (err) { console.error(err.message); process.exitCode = 1; } finally { await pool.end(); }

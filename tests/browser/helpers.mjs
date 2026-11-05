import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import pg from 'pg';

export { expect };
export const email = name => `${name.toLowerCase()}+clerk_test@example.com`;

// Uses Clerk's real email-code strategy, not an application auth override,
// fabricated token, localStorage session, or mocked /api/me response.
export async function signIn(page, name) {
  await clerk.loaded({ page });
  await clerk.signIn({
    page, signInParams: { strategy: 'email_code', identifier: email(name) },
  });
  await expect.poll(() => page.evaluate(() => window.Clerk.user?.primaryEmailAddress?.emailAddress))
    .toBe(email(name));
}

export async function navigate(page, path) {
  // Client-side navigation deliberately preserves React Query and in-flight requests.
  await page.evaluate(path => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

export async function api(page, path, method = 'GET', data) {
  return page.evaluate(async ({ path, method, data }) => {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      const csrf = await fetch('/api/auth/csrf').then(r => r.json());
      headers['X-CSRF-Token'] = csrf.csrfToken;
    }
    const response = await fetch(`/api${path}`, {
      method, headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}

export async function addSizedItem(page) {
  await navigate(page, '/product/campfire-fleece');
  await page.getByTestId('button-add-to-bag').click();
  await expect(page.getByRole('alert')).toHaveText('Pick a size first');
  await page.getByTestId('button-size-M').click();
  await expect(page.getByTestId('button-size-M')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('button-add-to-bag').click();
  await page.getByTestId('link-view-bag').click();
  await expect(page.getByTestId('row-bag-campfire-fleece-M')).toBeVisible();
}

export async function storedBag(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('raccoon-bag-v2') || '[]'));
}

export const test = base.extend({
  fixtures: async ({}, use) => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const run = `browser-${randomUUID()}`;
    const orders = [];
    const tickets = [];
    const sessions = [];
    const requests = [];
    const fixture = {
      run, db, tickets, sessions, requests,
      async order(owner, { status = 'Delivered', days = 2 } = {}) {
        const user = await db.query('SELECT id FROM retail.customers WHERE email=$1', [email(owner)]);
        if (user.rowCount !== 1) throw new Error('Development Alice/Bob seed missing; start the API workflow.');
        const id = randomUUID();
        const number = `E2E-${randomUUID().slice(0, 12)}`;
        await db.query(`INSERT INTO retail.orders
          (id,number,user_id,status,subtotal_cents,shipping_cents,total_cents,delivered_at,synthetic)
          VALUES($1,$2,$3,$4,6800,695,7495,
          CASE WHEN $4='Delivered' THEN now()-$5*interval '1 day' ELSE NULL END,true)`,
        [id, number, user.rows[0].id, status, days]);
        orders.push(id);
        await db.query(`INSERT INTO retail.order_items(id,order_id,slug,name,price_cents,quantity,size,image)
          VALUES($1,$2,'campfire-fleece','Campfire Fleece',6800,1,'M','/products/campfire-fleece.png')`,
        [randomUUID(), id]);
        return { id, number };
      },
    };
    try { await use(fixture); }
    finally {
      // Delete only IDs owned by this run. Never reset seeded account histories.
      try {
        for (const requestId of requests) {
          const result = await db.query('SELECT id AS session_id FROM retail.simulated_checkouts WHERE request_id=$1', [requestId]);
          for (const row of result.rows)
            if (row.session_id && !sessions.includes(row.session_id)) sessions.push(row.session_id);
        }
        for (const sessionId of sessions) {
          const result = await db.query('SELECT order_id AS id FROM retail.simulated_checkouts WHERE id=$1', [sessionId]);
          orders.push(...result.rows.map(r => r.id));
          await db.query('DELETE FROM retail.simulated_checkouts WHERE id=$1', [sessionId]);
        }
        for (const id of tickets) {
          await db.query('DELETE FROM retail.ticket_messages WHERE ticket_id=$1', [id]);
          await db.query('DELETE FROM retail.tickets WHERE id=$1', [id]);
        }
        for (const id of orders) {
          for (const table of ['return_requests', 'shipping_events', 'payments', 'order_items'])
            await db.query(`DELETE FROM retail.${table} WHERE order_id=$1`, [id]);
          await db.query('DELETE FROM retail.orders WHERE id=$1', [id]);
        }
      } finally { await db.end(); }
    }
  },
});

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.loaded({ page });
});

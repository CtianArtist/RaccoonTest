import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { test, expect, signIn, addSizedItem, api, storedBag, navigate } from './helpers.mjs';

test('fictional checkout persists independent Alice/Bob orders and rejects cross-customer status access', async ({ page, browser, fixtures }) => {
  const watch = page => {
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/checkout')
        fixtures.requests.push(request.postDataJSON().requestId);
    });
  };
  const create = async page => {
    await addSizedItem(page);
    await expect(page.getByText('Fictional research checkout.', { exact: false })).toBeVisible();
    await page.getByTestId('button-checkout').click();
    await expect(page).toHaveURL(/\/checkout\/success\?session_id=sim_/);
    const session = new URL(page.url()).searchParams.get('session_id');
    fixtures.sessions.push(session);
    await expect(page.getByTestId('state-order-confirmed')).toContainText('Fictional order created.');
    await expect.poll(() => storedBag(page)).toEqual([]);
    await page.reload();
    await expect(page.getByTestId('state-order-confirmed')).toBeVisible();
    const checkout = await api(page, `/checkout/sessions/${session}`);
    expect(checkout.body.state).toBe('completed');
    const order = await api(page, `/orders/${checkout.body.orderId}`);
    expect(order.status).toBe(200);
    expect(order.body).toMatchObject({ status: 'Processing', shippingStatus: 'Not shipped', returnStatus: 'None', synthetic: true });
    expect(order.body.number).toMatch(/^SIM-/);
    return { ...order.body, session };
  };
  watch(page);
  await signIn(page, 'Alice');
  const alice = await create(page);
  const bobContext = await browser.newContext({ baseURL: new URL(page.url()).origin, serviceWorkers: 'block' });
  try {
    const bobPage = await bobContext.newPage();
    watch(bobPage);
    await setupClerkTestingToken({ page: bobPage });
    await bobPage.goto('/');
    await signIn(bobPage, 'Bob');
    const bob = await create(bobPage);
    expect(alice.customerId).not.toBe(bob.customerId);
    expect(alice.number).not.toBe(bob.number);
    for (const [actor, own, foreign] of [[page, alice, bob], [bobPage, bob, alice]]) {
      for (const id of [own.id, own.number]) {
        const status = await api(actor, `/orders/${id}/status`);
        expect(status.status).toBe(200);
        expect(status.body).toMatchObject({ number: own.number, customerId: own.customerId, shippingStatus: 'Not shipped', returnStatus: 'None' });
      }
      for (const id of [foreign.id, foreign.number]) {
        expect((await api(actor, `/orders/${id}`)).status).toBe(404);
        expect((await api(actor, `/orders/${id}/status`)).status).toBe(404);
      }
      expect((await api(actor, `/checkout/sessions/${foreign.session}`)).status).toBe(404);
      const list = await api(actor, '/orders');
      expect(list.body.some(order => order.number === own.number)).toBe(true);
      expect(list.body.some(order => order.number === foreign.number)).toBe(false);
      await navigate(actor, '/account/orders');
      await expect(actor.getByText(own.number, { exact: false }).first()).toBeVisible();
      await expect(actor.getByText(foreign.number, { exact: false })).toHaveCount(0);
    }
  } finally {
    await bobContext.close();
  }
});

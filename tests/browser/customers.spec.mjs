import { clerk } from '@clerk/testing/playwright';
import { test, expect, signIn, navigate, api, addSizedItem, storedBag, email } from './helpers.mjs';

test('managed sign-in, size validation, quantities and cart persistence through reload and cancellation', async ({ page }) => {
  await addSizedItem(page);
  await page.getByTestId('button-increase-campfire-fleece-M').click();
  await expect(page.getByTestId('text-quantity-campfire-fleece-M')).toHaveText('2');
  await page.reload();
  await expect(page.getByTestId('text-quantity-campfire-fleece-M')).toHaveText('2');
  await page.getByTestId('link-sign-in-checkout').click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await signIn(page, 'Alice');
  await navigate(page, '/bag');
  await expect(page.getByTestId('button-checkout')).toBeVisible();
  await expect(page.getByTestId('text-quantity-campfire-fleece-M')).toHaveText('2');
  const before = await storedBag(page);
  await navigate(page, '/checkout/cancel');
  await expect(page.getByText('Checkout paused.', { exact: true })).toBeVisible();
  await page.getByTestId('link-return-bag').click();
  expect(await storedBag(page)).toEqual(before);
  await page.getByTestId('button-decrease-campfire-fleece-M').click();
  await expect(page.getByTestId('text-quantity-campfire-fleece-M')).toHaveText('1');
  await page.getByTestId('button-remove-campfire-fleece-M').click();
  await expect(page.getByTestId('row-bag-campfire-fleece-M')).toHaveCount(0);
  await page.reload();
  expect(await storedBag(page)).toEqual([]);
});

test('return and refund validation, persistence, duplicate and eligibility checks', async ({ page, fixtures }) => {
  const eligible = await fixtures.order('Alice');
  const refund = await fixtures.order('Alice');
  const expired = await fixtures.order('Alice', { days: 31 });
  const processing = await fixtures.order('Alice', { status: 'Processing' });
  await signIn(page, 'Alice');
  await navigate(page, '/account/returns');
  await expect(page.getByTestId('select-return-order')).toBeVisible();
  await expect(page.getByTestId('select-return-order').locator(`option[value="${expired.id}"]`)).toHaveCount(0);
  await expect(page.getByTestId('select-return-order').locator(`option[value="${processing.id}"]`)).toHaveCount(0);
  await page.getByTestId('button-submit-return').click();
  await expect(page.getByText('Choose an order.', { exact: true })).toBeVisible();
  await expect(page.getByText('Please confirm the item condition.', { exact: true })).toBeVisible();
  for (const [order, kind] of [[eligible, 'return'], [refund, 'refund']]) {
    await page.getByTestId('select-return-order').selectOption(order.id);
    await page.getByTestId(`button-kind-${kind}`).click();
    const reason = `${fixtures.run} ${kind}: the size does not fit.`;
    await page.getByTestId('input-return-reason').fill(reason);
    await page.getByTestId('checkbox-condition').check();
    const response = page.waitForResponse(r => r.url().endsWith('/api/returns') && r.request().method() === 'POST');
    await page.getByTestId('button-submit-return').click();
    const result = await response;
    expect(result.status()).toBe(201);
    const record = await result.json();
    await expect(page.getByTestId(`row-return-${record.id}`)).toContainText(reason);
    await page.reload();
    await expect(page.getByTestId(`row-return-${record.id}`)).toContainText(kind);
    expect((await api(page, '/returns', 'POST', {
      orderId: order.id, kind, reason, conditionConfirmed: true,
    })).status).toBe(409);
  }
  for (const order of [expired, processing]) {
    expect((await api(page, '/returns', 'POST', {
      orderId: order.id, kind: 'return', reason: 'Not eligible for this request', conditionConfirmed: true,
    })).status).toBe(409);
  }
});

test('private ticket creation and replies survive reload and cannot be read or changed by Bob', async ({ page, fixtures }) => {
  await signIn(page, 'Alice');
  await navigate(page, '/support');
  await page.getByTestId('input-ticket-subject').fill(fixtures.run);
  await page.getByTestId('input-ticket-description').fill('Private Alice details for a browser regression.');
  const created = page.waitForResponse(r => r.url().endsWith('/api/support/tickets') && r.request().method() === 'POST');
  await page.getByTestId('button-create-ticket').click();
  const result = await created;
  expect(result.status()).toBe(201);
  const ticket = await result.json();
  fixtures.tickets.push(ticket.id);
  await expect(page.getByTestId('text-ticket-subject')).toHaveText(fixtures.run);
  const reply = `${fixtures.run}: private reply from Alice`;
  await page.getByTestId('input-reply').fill(reply);
  await page.getByTestId('button-send-reply').click();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await expect(page.getByTestId('input-reply')).toHaveValue('');
  await page.reload();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await clerk.signOut({ page });
  await signIn(page, 'Bob');
  await navigate(page, `/support/tickets/${ticket.id}`);
  await expect(page.getByText('That ticket is not here.', { exact: true })).toBeVisible();
  await expect(page.getByText(reply, { exact: true })).toHaveCount(0);
  expect((await api(page, `/support/tickets/${ticket.id}`)).status).toBe(404);
  expect((await api(page, `/support/tickets/${ticket.id}/replies`, 'POST', { body: 'Unauthorized Bob reply' })).status).toBe(404);
  await navigate(page, '/support');
  await expect(page.getByTestId('input-ticket-subject')).toBeVisible();
  await expect(page.getByText(fixtures.run, { exact: true })).toHaveCount(0);
});

test('Alice/Bob cache isolation on sign-out, account changes and late Alice responses', async ({ page, fixtures }) => {
  const alice = await fixtures.order('Alice');
  const bob = await fixtures.order('Bob');
  await signIn(page, 'Alice');
  await navigate(page, '/account');
  await expect(page.getByTestId('text-email')).toHaveText(email('Alice'));
  await navigate(page, `/account/orders/${alice.id}`);
  await expect(page.getByRole('heading', { name: `Order ${alice.number}`, exact: true })).toBeVisible();
  await navigate(page, '/account/orders');
  await expect(page.getByTestId(`row-order-${alice.id}`)).toBeVisible();
  await expect(page.getByTestId(`row-order-${bob.id}`)).toHaveCount(0);
  await navigate(page, '/account');
  await expect(page.getByTestId('text-email')).toHaveText(email('Alice'));
  // Change accounts in the same React lifetime; no tenant settings or sessions
  // are overridden. The normal UI sign-out button is covered at the end.
  let release;
  let captured;
  let delivered;
  const gate = new Promise(resolve => { release = resolve; });
  const received = new Promise(resolve => { captured = resolve; });
  const responseDelivered = new Promise(resolve => { delivered = resolve; });
  await page.route('**/api/orders', async route => {
    const response = await route.fetch(); // Authentic Alice response, delayed in the browser only.
    captured();
    await gate;
    await route.fulfill({ response });
    delivered();
  }, { times: 1 });
  try {
    await navigate(page, '/account/orders');
    await received;
    await clerk.signOut({ page });
    await expect.poll(async () => (await api(page, '/me')).status).toBe(401);
    // Clerk's normal router callback returns to home on sign-out.
    await navigate(page, '/account/orders');
    await expect(page.getByTestId(`row-order-${alice.id}`)).toHaveCount(0);
    await expect(page.getByTestId('link-gate-sign-in')).toBeVisible();
    await signIn(page, 'Bob');
    release();
    await responseDelivered;
    await navigate(page, '/account');
    await expect(page.getByTestId('text-email')).toHaveText(email('Bob'));
    await navigate(page, '/account/orders');
    await expect(page.getByTestId(`row-order-${bob.id}`)).toBeVisible();
    await expect(page.getByTestId(`row-order-${alice.id}`)).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId(`row-order-${bob.id}`)).toBeVisible();
    await expect(page.getByTestId(`row-order-${alice.id}`)).toHaveCount(0);
    await navigate(page, `/account/orders/${alice.id}`);
    await expect(page.getByText('We could not find that order.', { exact: true })).toBeVisible();
    expect((await api(page, `/orders/${alice.id}`)).status).toBe(404);
    expect((await api(page, '/returns', 'POST', {
      orderId: alice.id, reason: 'Bob cannot return Alice goods', kind: 'return', conditionConfirmed: true,
    })).status).toBe(404);
    await page.getByTestId('button-sign-out').click();
    await expect.poll(() => page.evaluate(() => window.Clerk?.loaded && !window.Clerk.user)).toBeTruthy();
    // Wait for the normal asynchronous sign-out redirect before navigating again.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('link-sign-in')).toBeVisible();
    await navigate(page, '/account/orders');
    await expect(page.getByTestId('link-gate-sign-in')).toBeVisible();
    await expect(page.getByTestId(`row-order-${bob.id}`)).toHaveCount(0);
  } finally { release(); }
});

test('delayed order loading: no receipt or cart clearing before completed checkout and owned order load', async ({ page, fixtures }) => {
  await signIn(page, 'Alice');
  const order = await fixtures.order('Alice', { status: 'Processing' });
  await addSizedItem(page);
  const before = await storedBag(page);
  let state = 'pending';
  let polls = 0;
  let orderAvailable = false;
  const session = `sim_browser_${fixtures.run}`;
  // Deterministic loading/error contract; no provider or payment simulation.
  await page.route(`**/api/checkout/sessions/${session}`, route => {
    polls++;
    return route.fulfill({ json: { state, orderId: state === 'completed' ? order.id : null } });
  });
  await page.route(`**/api/orders/${order.id}`, async route => {
    if (!orderAvailable) return route.fulfill({ status: 503, json: { detail: 'Order still propagating' } });
    return route.continue();
  });
  await navigate(page, `/checkout/success?session_id=${session}`);
  await expect(page.getByTestId('state-checkout-pending')).toBeVisible();
  await expect.poll(() => polls).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('state-order-confirmed')).toHaveCount(0);
  expect(await storedBag(page)).toEqual(before);
  state = 'completed';
  await expect(page.getByText('Order saved, details still loading.', { exact: true })).toBeVisible();
  expect(await storedBag(page)).toEqual(before);
  orderAvailable = true;
  await page.getByRole('button', { name: /try again/i }).click();
  await expect(page.getByTestId('state-order-confirmed')).toContainText(order.number);
  await expect.poll(() => storedBag(page)).toEqual([]);
  await page.getByTestId('link-track-order').click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${order.id}$`));
});

test('missing, foreign, failed and expired confirmation URLs never clear the bag', async ({ page }) => {
  await signIn(page, 'Alice');
  await addSizedItem(page);
  const before = await storedBag(page);
  await navigate(page, '/checkout/success');
  await expect(page.getByText('No checkout to confirm.', { exact: true })).toBeVisible();
  expect(await storedBag(page)).toEqual(before);
  await navigate(page, '/checkout/success?session_id=sim_does_not_exist');
  await expect(page.getByText('We could not find this checkout.', { exact: true })).toBeVisible();
  expect(await storedBag(page)).toEqual(before);
  for (const state of ['failed', 'expired']) {
    await page.route(`**/api/checkout/sessions/sim_${state}`, route =>
      route.fulfill({ json: { state, orderId: null } }));
    // Remount page so query state/timers are fresh, while preserving the real session/cart.
    await page.goto(`/checkout/success?session_id=sim_${state}`);
    await expect(page.getByText(state === 'expired' ? 'That checkout expired.' : 'Checkout did not complete.', { exact: true })).toBeVisible();
    expect(await storedBag(page)).toEqual(before);
    await expect(page.getByTestId('state-order-confirmed')).toHaveCount(0);
  }
});

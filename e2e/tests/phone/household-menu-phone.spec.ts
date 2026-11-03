import { test, expect, open, isoDay } from '../fixtures';

// On a phone the transaction menu opens from each card's ⋯ button (or a long press), and its
// "Share with" list opens in place, with Back.

test('shares a payment with a household from the card menu', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 20000);
  const payment = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4500,
    payeeName: 'Mock Grocer',
  });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Actions for Mock Grocer' }).click();
  const menu = page.getByRole('menu', { name: 'Actions for Mock Grocer' });
  await menu.getByRole('menuitem', { name: 'Share with' }).click();
  const list = page.getByRole('menu', { name: 'Share with' });
  await expect(list.getByRole('menuitem', { name: 'Back' })).toBeVisible();
  await list.getByRole('menuitem', { name: 'Back' }).click();
  await menu.getByRole('menuitem', { name: 'Share with' }).click();
  // Fits the screen
  const box = (await list.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await list.getByRole('menuitem', { name: /^Flat/ }).click();
  await expect(page.getByTestId('undo-toast')).toContainText('Shared with Flat.');
  await expect(
    page.getByTestId('transaction-card').getByRole('img', { name: 'Shared with Flat' }),
  ).toBeVisible();
  const state = await api.call('GET', `/households/${group.group.id}`);
  expect(state.events.map((e: { transactionId: string }) => e.transactionId)).toEqual([payment.id]);
});

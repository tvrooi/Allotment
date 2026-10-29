import { test, expect, open } from './fixtures';

// Home dashboard personalization (phase 8): cards can be hidden, moved and reset per
// device. Presentation only: balances and transactions never change.

test('hides, moves and resets home cards, keeping them across a reload', async ({ page, api }) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await open(page, '/dashboard');
  const cards = page.locator('[data-testid^="home-card-"]');
  await expect(cards.first()).toHaveAttribute('data-testid', 'home-card-net-worth');

  await page.getByRole('button', { name: 'Customize' }).click();
  const dialog = page.getByRole('dialog', { name: 'Customize home' });
  await dialog.getByRole('checkbox', { name: 'Net worth' }).uncheck();
  await dialog.getByRole('button', { name: 'Move Recent transactions up' }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId('home-card-net-worth')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('home-card-net-worth')).toHaveCount(0);
  // Cards load independently; read the order once both compared cards are on the page
  await expect(page.getByTestId('home-card-recent-transactions')).toBeVisible();
  await expect(page.getByTestId('home-card-spending-breakdown')).toBeVisible();
  const order = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(order.indexOf('home-card-recent-transactions')).toBeLessThan(
    order.indexOf('home-card-spending-breakdown'),
  );

  // Hiding everything leaves a way back, and nothing in the budget changed
  await page.getByRole('button', { name: 'Customize' }).click();
  for (const box of await dialog.getByRole('checkbox').all()) await box.uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('All cards are hidden')).toBeVisible();
  await page.getByRole('button', { name: 'Show the default cards' }).click();
  await expect(cards.first()).toHaveAttribute('data-testid', 'home-card-net-worth');
  expect(await api.balance(account.id)).toBe(150_000);
});

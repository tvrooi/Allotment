import { test, expect, open, isoDay } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

test('the assign block names the account, the gap and links to the fixes', async ({
  page,
  api,
}) => {
  test.info().annotations.push({
    type: 'allow-page-errors',
    description: 'Expected refusal to assign while an account disagrees with its bank',
  });
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
  await freshUpWindow(page, api, 8);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  await api.call('POST', '/up/sync');
  const bank = (await api.accounts()).find((a: any) => a.bankLinked && a.balance > 0)!;
  // A cash coffee typed into the bank account: now it disagrees with the bank by $14.50
  const coffee = await api.createTransaction({
    accountId: bank.id,
    date: isoDay(),
    amount: -1_450,
    payeeName: 'Corner cafe',
  });

  await open(page, '/budget');
  await page
    .getByRole('button', { name: /^Planned for / })
    .first()
    .click();
  const input = page.getByRole('textbox', { name: /^Planned for / });
  await input.fill('100');
  await input.press('Enter');
  const alert = page.getByRole('alert').filter({ hasText: "Money can't be assigned" });
  await expect(alert).toContainText(`${bank.name}: FlyBudget has`);
  await expect(alert).toContainText('14.50 less in FlyBudget');

  await expect(alert.getByRole('link', { name: 'reconcile it' })).toHaveAttribute(
    'href',
    new RegExp(`/accounts/${bank.id}/reconcile$`),
  );

  // Review the transactions: the link opens the account, where the hand-entered row can go
  await alert.getByRole('link', { name: `Review ${bank.name}'s transactions` }).click();
  await expect(page).toHaveURL(new RegExp(`/accounts/${bank.id}$`));
  await api.call('DELETE', `/transactions/${coffee.id}`);

  // With the row gone the same assignment goes through
  await open(page, '/budget');
  await page
    .getByRole('button', { name: /^Planned for / })
    .first()
    .click();
  const again = page.getByRole('textbox', { name: /^Planned for / });
  await again.fill('100');
  await again.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: "Money can't be assigned" })).toHaveCount(
    0,
  );

  await api.call('DELETE', '/up/connection');
});

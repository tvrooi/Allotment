import { test, expect, open, isoDay, thisMonth } from './fixtures';
import { sidewaysOverflow } from './phone/overflow';

for (const width of [430, 1512]) {
  test(`dashboard leads with the next step and the 30-day commitments at ${width}px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 932 });
    const account = await api.createAccount('Everyday', 250_000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -1000,
      payeeName: 'Shop',
    });
    for (let index = 0; index < 5; index++) {
      await api.call('POST', '/schedules', {
        name: `Bill ${index}`,
        amount: -1000,
        recurrenceType: 'monthly',
        startDate: isoDay(2),
        accountId: account.id,
      });
    }
    for (let index = 0; index < 3; index++) {
      await api.call('POST', '/schedules', {
        name: `Pay ${index}`,
        amount: 10000,
        recurrenceType: 'monthly',
        startDate: isoDay(index + 1),
        accountId: account.id,
      });
    }
    await open(page, '/dashboard');
    await page.getByRole('button', { name: 'Hide getting started' }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('left to spend');
    const attention = page.getByRole('region', { name: 'Review attention' });
    const task = attention.getByRole('heading', { level: 2 });
    await expect(task).toHaveText('Give 1 transaction a category');
    await expect(task.getByRole('link')).toHaveAttribute('href', /transactions/);
    await expect(attention.getByText(/^1 of \d+ next steps for your budget$/)).toBeVisible();
    // The card's one button, at every width, and big enough to tap on a phone
    const review = attention.getByRole('link', { name: 'Open review', exact: true });
    await expect(review).toBeVisible();
    await expect(review).toHaveAttribute('href', '#/review');
    expect((await review.boundingBox())!.height).toBeGreaterThanOrEqual(width === 430 ? 44 : 40);
    expect((await task.getByRole('link').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Wider screens show the steps after the first beside it, not an empty row
    const then = attention.getByRole('list', { name: 'Then' });
    if (width === 430) await expect(then).toBeHidden();
    else await expect(then.getByRole('listitem').first()).toBeVisible();
    const bills = page.getByTestId('home-card-upcoming-bills');
    await expect(bills.getByText('Next 30 days', { exact: true })).toBeVisible();
    await expect(
      bills.getByRole('link', {
        name: `${width === 430 ? 3 : 2} more bills · View all`,
        exact: true,
      }),
    ).toBeVisible();
    const summary = page.getByTestId('home-card-summary');
    if (width === 430) {
      // One explanation for the summary, with the history below the cards it splits around
      await expect(summary.getByText(/calculated$/)).toHaveCount(0);
      const definition = page
        .getByTestId('home-history')
        .getByText('How these figures are calculated', {
          exact: true,
        });
      await definition.click();
      await expect(page.getByText(/This is budget money available to spend/)).toBeVisible();
      await expect(page.getByText('Monthly averages', { exact: true })).toBeVisible();
      await definition.click();
      await expect(bills.getByText('Pay 0', { exact: true })).toBeVisible();
      await expect(bills.getByText('Pay 1', { exact: true })).toHaveCount(0);
      await expect(
        bills.getByRole('link', { name: '2 more income entries · View all', exact: true }),
      ).toBeVisible();
      await expect(bills.getByText('Bill 0', { exact: true })).toBeVisible();
      await expect(bills.getByText('Bill 2', { exact: true })).toHaveCount(0);
      expect((await bills.boundingBox())!.height).toBeLessThan(500);
      await expect(summary.getByText('Income / month', { exact: true })).toHaveCount(0);
      const history = page.getByTestId('home-history');
      await expect(history.getByText('Income / month', { exact: true })).toBeVisible();
      expect((await history.boundingBox())!.y).toBeGreaterThan((await bills.boundingBox())!.y);
    } else {
      // Budget and Bills share a row and end together
      const budget = (await page.getByTestId('home-card-budget-progress').boundingBox())!;
      const billsBox = (await bills.boundingBox())!;
      expect(Math.abs(budget.y - billsBox.y)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(budget.y + budget.height - (billsBox.y + billsBox.height)),
      ).toBeLessThanOrEqual(1);
      await expect(page.getByText(/calculated$/)).toHaveCount(1);
    }
    // Left to spend's pace: the month's spending money used beside how far the month is
    await expect(
      summary.getByText(/^0% of spending money used · \d+% through the month$/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit savings target' }).click();
    await expect(page.getByRole('combobox', { name: 'Savings rate goal' })).toBeVisible();
    expect(await sidewaysOverflow(page)).toEqual([]);
    await review.click();
    await expect(page).toHaveURL(/#\/review$/);
  });
}

test('the status strip shows a household balance, and nothing when no item applies', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 250_000);
  await open(page, '/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // No bank feed and no household: no strip at all, not an empty box
  await expect(page.getByRole('region', { name: 'Budget status' })).toHaveCount(0);

  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Alex'],
    selfIndex: 0,
  });
  const [me, alex] = group.people.map((p: { id: string }) => p.id);
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: isoDay(),
    description: 'Groceries',
    amount: 12_000,
    payerId: me,
    shares: [
      { personId: me, value: 1 },
      { personId: alex, value: 1 },
    ],
  });
  await page.reload();
  const strip = page.getByRole('region', { name: 'Budget status' });
  const balance = strip.getByRole('link', { name: /^Flat/ });
  // In the household's currency, as the Household page writes it
  await expect(balance).toHaveText(/^Flat You’re owed A?\$60(\.00)?$/);
  const owed = (await balance.innerText()).replace(/^Flat\s+/, '');
  await expect(balance).toHaveAttribute('href', `#/household?household=${group.group.id}`);
  // The same answer the Household page leads with
  await balance.click();
  await expect(page.getByRole('region', { name: 'Who owes whom' })).toContainText(owed);

  // Safe mode hides the amount
  await open(page, '/dashboard');
  await page.keyboard.press('Alt+Shift+H');
  await expect(
    strip.getByRole('link', { name: /^Flat/ }).getByRole('img', { name: 'Hidden' }),
  ).toBeVisible();
  await expect(strip).not.toContainText('60');
});

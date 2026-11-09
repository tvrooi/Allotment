import { test, expect, open, isoDay, type Api } from './fixtures';

// B9: housemates' money into a household account is never the owner's income. Recurring →
// Monthly counts a shared bill at the owner's share and keeps the household account apart, and
// the dashboard's "Next pay" is the owner's own pay. Disposable data only.

const dayOfMonth = new Date().getDate();
/** The first day of this month, plus some days (never past the month's 28th) */
const thisMonth = (plus = 0) => isoDay(1 - dayOfMonth + plus);

async function household(api: Api) {
  const spending = await api.createAccount('Spending', 500_000);
  const pool = await api.createAccount('2Up', 0, 'checking', { currency: 'AUD' });
  await api.call('POST', '/households', {
    name: 'Home',
    currency: 'AUD',
    accountId: pool.id,
    people: ['Me', 'Juno', 'Kai'],
    selfIndex: 0,
  });
  const weekly = (name: string, amount: number, accountId: string, start: string) =>
    api.call<{ id: string }>('POST', '/schedules', {
      name,
      amount,
      recurrenceType: 'weekly',
      startDate: start,
      accountId,
    });
  // Juno pays in a day before the owner's pay, so a sign-only rule would take it as pay
  const juno = await weekly('Juno rent', 80_000, pool.id, thisMonth());
  const pay = await weekly('ACME pay', 300_000, spending.id, thisMonth(1));
  await api.call('POST', '/schedules', {
    name: 'Rent',
    amount: -240_000,
    recurrenceType: 'monthly',
    startDate: thisMonth(),
    accountId: pool.id,
  });
  return { juno, pay };
}

test("housemates' deposits aren't income, and a shared bill counts at my share", async ({
  page,
  api,
}) => {
  const { juno, pay } = await household(api);
  const occurrences = await api.call<any[]>(
    'GET',
    `/schedules/occurrences?from=${thisMonth()}&to=${isoDay(40)}`,
  );
  expect(occurrences.find((o) => o.scheduleId === juno.id).scope).toMatchObject({
    kind: 'household',
    role: 'contribution',
    personName: 'Juno',
  });

  await open(page, '/recurring');
  const main = page.getByRole('main');
  await expect(main.getByText('Your share of Rent (Home)')).toBeVisible();
  await expect(main.getByText('$2,400 in all').first()).toBeVisible();
  // The household account is collapsed, so Juno's deposit is in neither Income nor Expenses
  const toggle = main.getByRole('button', { name: /Household account/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(main.getByText('Juno rent')).toHaveCount(0);
  // Income received counts the owner's pay only
  const month = isoDay().slice(0, 7);
  // A budget in AUD writes its amounts as plain $ (older builds wrote A$ on American devices)
  const money = (cents: number) => `A?\\$${(cents / 100).toLocaleString('en-AU')}`;
  const payTotal = occurrences
    .filter((o) => o.scheduleId === pay.id && o.expectedDate.startsWith(month))
    .reduce((sum, o) => sum + o.expectedAmount, 0);
  await expect(main.getByText(new RegExp(`of ${money(payTotal)}$`)).first()).toBeVisible();
  await toggle.click();
  await expect(main.getByText('Juno rent').first()).toBeVisible();
  await expect(main.getByText(/Contribution from Juno · Home/).first()).toBeVisible();

  // The dashboard's next pay is the owner's own
  const nextPay = occurrences.find(
    (o) => o.scheduleId === pay.id && o.expectedDate >= isoDay() && o.displayStatus !== 'paid',
  );
  const [y, m, d] = nextPay.expectedDate.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  // Something planned this month, so the dashboard's opening line names the next pay
  const groceries = await api.category('Groceries');
  await api.call('PUT', `/budget/${month}/${groceries.id}`, { budgeted: 10_000 });
  await open(page, '/');
  const bills = page.getByRole('region', { name: 'Bills' });
  await expect(bills.getByText('Rent')).toBeVisible();
  await expect(bills.getByText(new RegExp(`Shared, ${money(240_000)} in all`))).toBeVisible();
  await expect(page.getByRole('region', { name: 'Income' }).getByText('Juno rent')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    `Next pay ${label.replace(',', '')}.`,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/recurring');
  await expect(page.getByRole('main').getByText('Your share of Rent (Home)')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

import { test, expect, open, isoDay, typeAmount } from './fixtures';

// P3 investments (docs/INVESTMENTS.md): manual holdings, prices and purchases, kept apart from
// the ledger until the user records a value. Mock data only.

test('records a priced holding without touching the balance until asked', async ({ page, api }) => {
  const account = await api.createAccount('Mock brokerage', 100000, 'investment');
  await open(page, '/investments');
  await expect(page.getByRole('heading', { name: 'Investments' })).toBeVisible();

  // A security, then a holding of it in the account
  await page.getByRole('button', { name: 'Add holding' }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Add holding' });
  await dialog.getByRole('button', { name: "Add a security that isn't listed" }).click();
  dialog = page.getByRole('dialog', { name: 'Add security' });
  await dialog.getByLabel('Code').fill('mock');
  await dialog.getByLabel('Name').fill('Mock index fund');
  await dialog.getByRole('button', { name: 'Save' }).click();
  dialog = page.getByRole('dialog', { name: 'Add holding' });
  await expect(dialog.getByLabel('Security')).toContainText('MOCK · Mock index fund');
  await dialog.getByLabel('Units held').fill('10.5');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // No price yet: unvalued, never zero
  await expect(page.getByRole('cell', { name: 'No price' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a price' }).click();
  dialog = page.getByRole('dialog', { name: 'Price of MOCK' });
  await dialog.getByLabel('Date').fill(isoDay(-1));
  await dialog.getByLabel('Price per unit').fill('20');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('row', { name: /MOCK/ });
  await expect(row).toContainText(/\$210(\.00)?/);
  // No purchases: the cost is unknown and there's no gain
  await expect(page.getByRole('button', { name: 'Unknown' })).toBeVisible();

  await page.getByRole('button', { name: 'Unknown' }).click();
  dialog = page.getByRole('dialog', { name: 'Purchases of MOCK' });
  await expect(dialog.getByLabel('Units', { exact: true })).toHaveValue('10.5');
  await dialog.getByLabel('Bought on').fill(isoDay(-30));
  await dialog.getByLabel('Total cost').fill('150');
  await dialog.getByRole('button', { name: 'Add purchase' }).click();
  await expect(dialog).toContainText('Every unit has a known cost.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toContainText(/\$150(\.00)?/);
  await expect(row).toContainText(/\+A?\$60(\.00)?/);
  await expect(row).toContainText('+40.00%');

  // Nothing written to the ledger so far
  expect(await api.balance(account.id)).toBe(100000);

  await expect(page.getByText(/worth A?\$790(\.00)? less than the recorded balance/)).toBeVisible();
  await page.getByRole('button', { name: 'Record as value' }).click();
  dialog = page.getByRole('dialog', { name: 'Update value' });
  await expect(dialog).toContainText('adjustment dated today');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => api.balance(account.id)).toBe(21000);
  await expect(page.getByText(/than the recorded balance/)).toBeHidden();
});

// D3a (docs/INVESTMENT-SALES-AND-INCOME.md): selling chosen parcels, seeing the gain and the
// discount before saving, and finding the sale on Tax time as item 18
test('sells chosen parcels and shows the capital gain on Tax time', async ({ page, api }) => {
  const account = await api.createAccount('Mock share account', 0, 'investment');
  const security = await api.call('POST', '/investments/securities', {
    symbol: 'SELL',
    name: 'Mock share fund',
    kind: 'etf',
    currency: 'AUD',
  });
  const holding = await api.call('POST', '/investments/holdings', {
    accountId: account.id,
    securityId: security.id,
    quantity: 30_000_000,
  });
  const lot = (acquiredOn: string, quantity: number, costBasis: number) =>
    api.call('POST', `/investments/holdings/${holding.id}/lots`, {
      acquiredOn,
      quantity,
      costBasis,
    });
  const old = await lot(isoDay(-800), 20_000_000, 200_000);
  const recent = await lot(isoDay(-100), 10_000_000, 150_000);

  await open(page, '/investments');
  const row = page.getByRole('row', { name: /SELL/ });
  await row.getByRole('button', { name: 'Actions for SELL' }).click();
  await page.getByRole('menuitem', { name: 'Sell' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sell SELL' });
  const soldOn = isoDay(-10);
  await dialog.getByLabel('Sold on').fill(soldOn);
  await dialog.getByLabel('Units sold').fill('15');
  await typeAmount(dialog.getByLabel('Proceeds before brokerage'), '2400');
  await typeAmount(dialog.getByLabel('Sale brokerage'), '10');
  // First in, first out takes the old purchase first: all of it held over 12 months
  const gain = dialog.getByRole('region', { name: 'Gain on this sale' });
  await expect(gain).toContainText(/Capital gain A?\$890(\.00)?/);
  await expect(gain).toContainText('the 50% discount applies');

  await dialog.getByLabel('Choose parcels').check();
  await dialog.getByLabel(/^Bought .*20 left/).fill('5');
  await dialog.getByLabel(/^Bought .*10 left/).fill('10');
  // 5 old units: $796.66 less $500; 10 recent ones: $1,593.34 less $1,500
  await expect(gain).toContainText(/Capital gain A?\$390(\.00)?/);
  await expect(gain).toContainText('the discount applies to that part');
  await dialog.getByRole('button', { name: 'Record sale' }).click();
  await expect(dialog).toBeHidden();

  await expect(row.getByRole('cell').nth(1)).toHaveText('15');
  const saved = await api.call('GET', '/investments');
  const lots = saved.accounts
    .flatMap(
      (a: { holdings: { id: string; lots: { id: string; remaining: number }[] }[] }) => a.holdings,
    )
    .find((h: { id: string }) => h.id === holding.id).lots;
  expect(
    Object.fromEntries(lots.map((l: { id: string; remaining: number }) => [l.id, l.remaining])),
  ).toEqual({ [old.id]: 15_000_000, [recent.id]: 0 });

  // Tax time: the sale in its financial year's item 18
  const year =
    Number(soldOn.slice(5, 7)) >= 7 ? Number(soldOn.slice(0, 4)) : Number(soldOn.slice(0, 4)) - 1;
  await open(page, '/tax');
  await page
    .getByLabel('Financial year')
    .selectOption({ label: `${year}–${String(year + 1).slice(2)}` });
  const section = page.getByRole('region', { name: 'Capital gains (item 18)' });
  await expect(
    section.getByRole('row', { name: /18H Total current year capital gains/ }),
  ).toContainText(/A?\$390(\.00)?/);
  // The old parcel's $296.66 is halved (rounded down to $148.33 off); the recent $93.34 is not
  await expect(section.getByRole('row', { name: /18A Net capital gain/ })).toContainText(
    /A?\$241\.67/,
  );
  await expect(section.getByRole('row', { name: /SELL/ })).toContainText('Part');
});

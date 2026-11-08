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

// D3b: a franked dividend from its statement, the credit worked out at 30%, linked to its
// deposit, and item 11 on Tax time
test('records a franked dividend, links its deposit and shows item 11', async ({ page, api }) => {
  const account = await api.createAccount('Mock dividend account', 0, 'investment');
  const bank = await api.createAccount('Mock everyday', 0, 'checking');
  const security = await api.call('POST', '/investments/securities', {
    symbol: 'DIVI',
    name: 'Mock dividend fund',
    kind: 'stock',
    currency: 'AUD',
  });
  await api.call('POST', '/investments/holdings', {
    accountId: account.id,
    securityId: security.id,
    quantity: 100_000_000,
  });
  const paidOn = isoDay(-12);
  await api.createTransaction({
    accountId: bank.id,
    date: isoDay(-10),
    amount: 7_000,
    payeeName: 'Mock dividend deposit',
  });

  await open(page, '/investments');
  const row = page.getByRole('row', { name: /DIVI/ });
  await row.getByRole('button', { name: 'Actions for DIVI' }).click();
  await page.getByRole('menuitem', { name: 'Record a payment' }).click();
  let dialog = page.getByRole('dialog', { name: 'Record a payment from DIVI' });
  await dialog.getByLabel('Paid on').fill(paidOn);
  await typeAmount(dialog.getByLabel('Amount paid'), '70');
  await typeAmount(dialog.getByLabel('Franked amount', { exact: true }), '70');
  await dialog.getByRole('button', { name: '30%' }).click();
  await expect(dialog.getByLabel('Franking credit')).toHaveValue(/30(\.00)?/);
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(dialog).toBeHidden();

  await row.getByRole('button', { name: 'Actions for DIVI' }).click();
  await page.getByRole('menuitem', { name: 'Income (1)' }).click();
  dialog = page.getByRole('dialog', { name: 'Income from DIVI' });
  await expect(dialog).toContainText(/credit A?\$30(\.00)?/);
  await dialog.getByRole('button', { name: /^Link the deposit of the dividend/ }).click();
  await dialog.getByRole('button', { name: /^Link Mock dividend deposit/ }).click();
  await expect(dialog).toContainText('Deposit linked');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();

  // Tax time: the dividend in its financial year's item 11
  const year =
    Number(paidOn.slice(5, 7)) >= 7 ? Number(paidOn.slice(0, 4)) : Number(paidOn.slice(0, 4)) - 1;
  await open(page, '/tax');
  await page
    .getByLabel('Financial year')
    .selectOption({ label: `${year}–${String(year + 1).slice(2)}` });
  const section = page.getByRole('region', { name: 'Dividends and interest (items 10 and 11)' });
  await expect(section.getByRole('row', { name: /11T Franked amount/ })).toContainText(
    /A?\$70(\.00)?/,
  );
  await expect(section.getByRole('row', { name: /11U Franking credit/ })).toContainText(
    /A?\$30(\.00)?/,
  );
});

// D3c: a 2-for-1 split doubles the units held, previews it first, and an earlier sale keeps its cost
test('splits a holding after a part sale and keeps the earlier sale’s gain', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Mock split account', 0, 'investment');
  const security = await api.call('POST', '/investments/securities', {
    symbol: 'SPLT',
    name: 'Mock split fund',
    kind: 'stock',
    currency: 'AUD',
  });
  const holding = await api.call('POST', '/investments/holdings', {
    accountId: account.id,
    securityId: security.id,
    quantity: 100_000_000,
  });
  await api.call('POST', `/investments/holdings/${holding.id}/lots`, {
    acquiredOn: isoDay(-800),
    quantity: 100_000_000,
    costBasis: 10_000,
  });
  const sale = await api.call('POST', `/investments/holdings/${holding.id}/sales`, {
    soldOn: isoDay(-60),
    quantity: 40_000_000,
    proceeds: 8_000,
    fees: 0,
  });

  await open(page, '/investments');
  const row = page.getByRole('row', { name: /SPLT/ });
  await expect(row.getByRole('cell').nth(1)).toHaveText('60');
  await row.getByRole('button', { name: 'Actions for SPLT' }).click();
  await page.getByRole('menuitem', { name: 'Split or consolidate' }).click();
  const dialog = page.getByRole('dialog', { name: 'Split or consolidate SPLT' });
  await dialog.getByLabel('Effective on').fill(isoDay(-30));
  await dialog.getByLabel('New units').fill('2');
  await dialog.getByLabel('For every old unit(s)').fill('1');
  await expect(dialog).toContainText(
    'You hold 60 units now; after the 2 for 1 split you will hold 120',
  );
  await dialog.getByRole('button', { name: 'Record' }).click();
  await expect(dialog).toBeHidden();

  await expect(row.getByRole('cell').nth(1)).toHaveText('120');
  // The cost of the 120 units left is the other $60, and the earlier sale still cost $40
  await expect(row).toContainText(/A?\$60(\.00)?/);
  const saved = await api.call('GET', '/investments');
  const found = saved.accounts
    .flatMap(
      (a: { holdings: { id: string; sales: { id: string; cost: number }[] }[] }) => a.holdings,
    )
    .find((h: { id: string }) => h.id === holding.id);
  expect(found.sales.find((s: { id: string }) => s.id === sale.id).cost).toBe(4_000);
});

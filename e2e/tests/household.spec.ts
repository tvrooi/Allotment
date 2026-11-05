import { test, expect, open, isoDay, typeAmount } from './fixtures';

test('records shared expenses, exports personal scope and keeps the bank debit intact', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('My bank', 20000);
  const payment = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -12000,
    payeeName: 'Dinner',
  });
  await open(page, '/household');
  await page.getByLabel('Name', { exact: true }).fill('Home');
  await page.getByLabel('People, one per line; put yourself first').fill('Me\nAlex');
  await page.getByRole('button', { name: 'Create household', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'People & balances' })).toBeVisible();
  await page.getByRole('button', { name: 'Expense, advance or repayment' }).click();
  const event = page.getByRole('heading', { name: 'Record something else' }).locator('../..');
  await event.getByLabel('Description', { exact: true }).fill('Shared dinner');
  await event.getByLabel('Date', { exact: true }).fill('2026-10-21');
  await event.getByLabel('Amount (AUD)').fill('120.00');
  await event.getByLabel('Paid by').selectOption({ label: 'Me' });
  await event.getByLabel('Existing bank payment (optional)').selectOption(payment.id);
  await event.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByRole('heading', { name: /My expense shares:.*60/ })).toBeVisible();
  await page.getByLabel('Report scope').selectOption('household');
  await expect(page.getByRole('heading', { name: /Household spending:.*120/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Report scope')).toHaveValue('household');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this statement' }).click();
  expect((await download).suggestedFilename()).toBe('household-household-statement.json');
  expect((await api.transactions()).find((t) => t.id === payment.id).amount).toBe(-12000);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: test.info().outputPath('household.png'), fullPage: true });
});

test('prepaid pool expenses do not create a second reimbursement claim', async ({ page, api }) => {
  const account = await api.createAccount('Joint', 0, 'checking', { currency: 'AUD' });
  const group = await api.call('POST', '/households', {
    name: 'Household',
    currency: 'AUD',
    accountId: account.id,
    people: ['Me', 'Alex'],
    selfIndex: 0,
  });
  for (const person of group.people)
    await api.call('POST', `/households/${group.group.id}/events`, {
      kind: 'contribution',
      date: '2026-10-21',
      description: 'Rent advance',
      amount: 6000,
      payerId: person.id,
    });
  const payment = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -12000,
    payeeName: 'Rent',
  });
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: '2026-10-21',
    description: 'Rent',
    amount: 12000,
    transactionId: payment.id,
    shares: group.people.map((p: any) => ({ personId: p.id, value: 1 })),
  });
  const ledger = await api.call('GET', `/households/${group.group.id}`);
  expect(Object.values(ledger.balances)).toEqual([0, 0]);
  await open(page, '/household');
  await expect(page.getByRole('heading', { name: 'People & balances' })).toBeVisible();
  await expect(page.getByText(/Received pool funding remaining:/)).toContainText('$0');
});

test('shares a payment with the household in one step, with the default split', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 20000);
  const payment = await api.createTransaction({
    accountId: account.id,
    date: isoDay(), // the register opens on this month
    amount: -9000,
    payeeName: 'Groceries run',
  });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno', 'Zephyr'],
    selfIndex: 0,
  });
  await open(page, '/household');
  const sharing = page.getByRole('region', { name: 'Sharing' });
  await sharing.getByLabel('Split').selectOption('percentage');
  await sharing.getByLabel("Me's percentage").fill('40');
  await sharing.getByLabel("Juno's percentage").fill('30');
  await sharing.getByLabel("Zephyr's percentage").fill('30');
  await sharing.getByRole('button', { name: 'Save split' }).click();
  await expect(sharing).toContainText('Now Me 40%, Juno 30%, Zephyr 30%');

  await open(page, `/accounts/${account.id}`);
  await page.getByText('Groceries run').first().click();
  // Sharing the whole list waits for "Select all"
  await page.getByRole('button', { name: 'Select all 1' }).click();
  await page.getByRole('button', { name: 'Share with household' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with household' });
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Shared 1.');
  const state = await api.call('GET', `/households/${group.group.id}`);
  const event = state.events.find((e: { transactionId: string }) => e.transactionId === payment.id);
  expect(event.shares.map((s: { amount: number }) => s.amount)).toEqual([3600, 2700, 2700]);
});

test('a household picture shows on the payments shared with it', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 20000);
  const shared = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4500,
    payeeName: 'Mock Grocer',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -800,
    payeeName: 'Mock Cafe',
  });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });

  // Upload a picture in Household → Sharing (a 1×1 PNG, resized to a small square)
  await open(page, '/household');
  const sharing = page.getByRole('region', { name: 'Sharing' });
  await sharing.getByTestId('household-logo-input').setInputFiles({
    name: 'flat.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(sharing.getByRole('button', { name: 'Remove the picture for Flat' })).toBeVisible();
  const [listed] = await api.call('GET', '/households');
  expect(listed.logo).toMatch(/^data:image\/png;base64,/);

  await api.call('POST', `/households/${group.group.id}/share`, { transactionIds: [shared.id] });
  await open(page, `/accounts/${account.id}`);
  const rows = page.getByTestId('transaction-row');
  const badge = rows
    .filter({ hasText: 'Mock Grocer' })
    .getByRole('img', { name: 'Shared with Flat' });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('src', listed.logo);
  await expect(
    rows.filter({ hasText: 'Mock Cafe' }).getByRole('img', { name: 'Shared with Flat' }),
  ).toHaveCount(0);

  // The details say where it's shared instead of offering to share it again
  await rows.filter({ hasText: 'Mock Grocer' }).getByText('$45').click();
  const status = page.getByTestId('shared-with-household');
  await expect(status).toContainText('Shared with Flat');
  const actions = status.locator('..');
  await expect(actions.getByRole('button', { name: 'Share with household' })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Share with people' })).toHaveCount(0);
  await status.getByRole('button', { name: 'View in household' }).click();
  await expect(page).toHaveURL(new RegExp(`/household\\?household=${group.group.id}$`));
  await expect(page.getByRole('heading', { name: 'People & balances' })).toBeVisible();

  // Without a picture, the household's initial shows instead
  await page
    .getByRole('region', { name: 'Sharing' })
    .getByRole('button', { name: 'Remove the picture for Flat' })
    .click();
  await expect.poll(async () => (await api.call('GET', '/households'))[0].logo).toBeNull();
  await open(page, `/accounts/${account.id}`);
  await expect(
    rows.filter({ hasText: 'Mock Grocer' }).getByRole('img', { name: 'Shared with Flat' }),
  ).toHaveText('F');
});

test('right-click shares a payment with a household, and Undo or Stop sharing reverses it', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 20000);
  const grocer = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4500,
    payeeName: 'Mock Grocer',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 250000,
    payeeName: 'Mock Employer',
  });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno', 'Zephyr'],
    selfIndex: 0,
  });
  const entries = async () =>
    (await api.call('GET', `/households/${group.group.id}`)).events.filter(
      (e: { transactionId: string }) => e.transactionId === grocer.id,
    );
  await open(page, `/accounts/${account.id}`);
  const row = page.getByTestId('transaction-row').filter({ hasText: 'Mock Grocer' });
  const badge = row.getByRole('img', { name: 'Shared with Flat' });
  const toast = page.getByTestId('undo-toast');

  // Right-click → Share with → Flat shares it at once, with the default split
  await row.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Actions for Mock Grocer' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Share with' }).hover();
  const households = page.getByRole('menu', { name: 'Share with' });
  await expect(households.getByRole('menuitem', { name: /^Flat/ })).toContainText('split equally');
  await households.getByRole('menuitem', { name: /^Flat/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(toast).toContainText('Shared with Flat.');
  await expect(badge).toBeVisible();
  expect((await entries())[0].shares.map((s: { amount: number }) => s.amount)).toEqual([
    1500, 1500, 1500,
  ]);
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(badge).toHaveCount(0);
  expect(await entries()).toEqual([]);

  // From the keyboard: Shift+F10 on the focused row, arrows to the household, Enter
  await row.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu.getByRole('menuitem', { name: 'Open details' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Share with' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(households.getByRole('menuitem', { name: /^Flat/ })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(households).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: 'Share with' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(badge).toBeVisible();
  // A custom split made on the Household page would survive Stop sharing → Undo exactly
  const [shared] = await entries();
  await api.call('DELETE', `/households/${group.group.id}/events/${shared.id}`);
  const [me, juno, zephyr] = group.people.map((p: { id: string }) => p.id);
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: grocer.date,
    description: 'Mock Grocer',
    amount: 4500,
    payerId: me,
    transactionId: grocer.id,
    mode: 'exact',
    shares: [
      { personId: me, value: 2500 },
      { personId: juno, value: 2000 },
      { personId: zephyr, value: 0 },
    ],
  });
  await page.reload();

  // Already shared: the menu shows where, and stops sharing (Undo restores the same split)
  await row.click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: /^View in Flat/ })).toContainText(
    'Shared with Flat',
  );
  await expect(menu.getByRole('menuitem', { name: 'Share with' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Stop sharing with Flat' }).click();
  await expect(toast).toContainText('Stopped sharing Mock Grocer with Flat.');
  await expect(badge).toHaveCount(0);
  expect(await entries()).toEqual([]);
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(badge).toBeVisible();
  const [restored] = await entries();
  expect(restored.shares.map((s: { amount: number }) => s.amount)).toEqual([2500, 2000, 0]);
  await row.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: /^View in Flat/ }).click();
  await expect(page).toHaveURL(new RegExp(`/household\\?household=${group.group.id}$`));
  await page.goBack();

  // Money in can't be shared: the item says why. Escape closes the menu
  const pay = page.getByTestId('transaction-row').filter({ hasText: 'Mock Employer' });
  await pay.click({ button: 'right' });
  const payMenu = page.getByRole('menu', { name: 'Actions for Mock Employer' });
  const disabled = payMenu.getByRole('menuitem', { name: /^Share with/ });
  await expect(disabled).toBeDisabled();
  await expect(disabled).toContainText('Only money out can be shared');
  await page.keyboard.press('Escape');
  await expect(payMenu).toHaveCount(0);

  // Open details from the menu
  await pay.click({ button: 'right' });
  await payMenu.getByRole('menuitem', { name: 'Open details' }).click();
  await expect(page.getByRole('button', { name: 'Create rule' })).toBeVisible();
});

test('share, stop sharing, then undo and redo both, in order', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 20000);
  const grocer = await api.createTransaction({
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
  const shared = async () =>
    (await api.call('GET', `/households/${group.group.id}`)).events.filter(
      (e: { transactionId: string }) => e.transactionId === grocer.id,
    ).length;
  await open(page, `/accounts/${account.id}`);
  const row = page.getByTestId('transaction-row').filter({ hasText: 'Mock Grocer' });
  const badge = row.getByRole('img', { name: 'Shared with Flat' });
  const menu = page.getByRole('menu', { name: 'Actions for Mock Grocer' });

  await row.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Share with' }).hover();
  await page
    .getByRole('menu', { name: 'Share with' })
    .getByRole('menuitem', { name: /^Flat/ })
    .click();
  await expect(badge).toBeVisible();
  await row.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Stop sharing with Flat' }).click();
  await expect(badge).toHaveCount(0);

  // Undo the stop (recorded again, with a new id), then undo the share itself
  await page.keyboard.press('Control+z');
  await expect(badge).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(badge).toHaveCount(0);
  await expect.poll(shared).toBe(0);
  // And forward again: shared, then stopped
  await page.keyboard.press('Control+Shift+z');
  await expect(badge).toBeVisible();
  await expect.poll(shared).toBe(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(badge).toHaveCount(0);
  await expect.poll(shared).toBe(0);
});

test('right-clicking one of several picked payments shares all of them', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 20000);
  const ids: string[] = [];
  for (const [payeeName, amount] of [
    ['Mock Fuel', -6000],
    ['Mock Dinner', -8000],
    ['Mock Solo', -1000],
  ] as const)
    ids.push(
      (await api.createTransaction({ accountId: account.id, date: isoDay(), amount, payeeName }))
        .id,
    );
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Pick to share' }).click();
  await page.getByRole('checkbox', { name: /^Pick Mock Fuel/ }).check();
  await page.getByRole('checkbox', { name: /^Pick Mock Dinner/ }).check();
  await page
    .getByTestId('transaction-row')
    .filter({ hasText: 'Mock Fuel' })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Share 2 picked with' }).hover();
  await page
    .getByRole('menu', { name: 'Share 2 picked with' })
    .getByRole('menuitem', { name: /^Flat/ })
    .click();
  await expect(page.getByTestId('undo-toast')).toContainText('Shared 2 with Flat.');
  const state = await api.call('GET', `/households/${group.group.id}`);
  expect(state.events.map((e: { transactionId: string }) => e.transactionId).sort()).toEqual(
    [ids[0], ids[1]].sort(),
  );
});

test('picks payments in the register and shares just those, split equally', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 50000);
  const dinner = await api.createTransaction({
    accountId: account.id,
    date: isoDay(), // the register opens on this month
    amount: -6001,
    payeeName: 'Dinner for two',
  });
  const solo = await api.createTransaction({
    accountId: account.id,
    date: isoDay(), // the register opens on this month
    amount: -1500,
    payeeName: 'Solo coffee',
  });
  const fuel = await api.createTransaction({
    accountId: account.id,
    date: isoDay(), // the register opens on this month
    amount: -8000,
    payeeName: 'Road trip fuel',
  });
  const group = await api.call('POST', '/households', {
    name: 'King-Grey',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Edward'],
    selfIndex: 0,
  });

  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Pick to share' }).click();
  const bar = page.getByRole('region', { name: 'Picked payments' });
  await page.getByLabel(/^Pick Dinner for two/).check();
  await page.getByLabel(/^Pick Road trip fuel/).check();
  await expect(bar).toContainText('2 picked');
  await bar.getByRole('button', { name: 'Share 2 picked with household' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with household' });
  await expect(dialog).toContainText('split equally');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Shared 2.');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(bar).toContainText('0 picked');

  const state = await api.call('GET', `/households/${group.group.id}`);
  const shared = state.events.map((e: { transactionId: string }) => e.transactionId).sort();
  expect(shared).toEqual([dinner.id, fuel.id].sort());
  expect(shared).not.toContain(solo.id);
  const dinnerEvent = state.events.find(
    (e: { transactionId: string }) => e.transactionId === dinner.id,
  );
  // Equal split, largest remainder: the odd cent goes to one of them, not always the first
  expect(dinnerEvent.shares.map((s: { amount: number }) => s.amount).sort()).toEqual([3000, 3001]);
});

test('lists recurring bills shared with housemates, with shares and one-click sharing', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Up Spending', 100000);
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const bills = [
    ['Electricity (OVO)', 'OVO Energy', -18450],
    ['Internet (Superloop)', 'Superloop', -8999],
  ] as const;
  for (const [name, payeeName, amount] of bills) {
    const paid = await api.createTransaction({
      accountId: account.id,
      date: day(-5),
      amount,
      payeeName,
    });
    await api.call('POST', '/schedules', {
      name,
      amount,
      recurrenceType: 'monthly',
      recurrenceRule: { type: 'monthly', interval: 1, anchorDay: 1 },
      startDate: day(-5),
      accountId: account.id,
      payeeId: paid.payeeId,
    });
  }
  await api.call('POST', '/households', {
    name: 'Home',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Sam', 'Jo'],
    selfIndex: 0,
  });
  await open(page, '/household');
  const recurring = page.getByRole('region', { name: 'Recurring bills' });
  await expect(recurring).toContainText('No recurring bills shared yet');
  // No household account: the pool figures stay out of the way
  await expect(page.getByText(/Received pool funding remaining:/)).toHaveCount(0);
  await recurring.getByRole('button', { name: 'Add recurring bills' }).click();
  await recurring.getByLabel('Electricity (OVO)').check();
  await recurring.getByLabel('Internet (Superloop)').check();
  await recurring.getByRole('button', { name: 'Share 2 with household' }).click();
  await expect(recurring.getByRole('listitem')).toHaveCount(2);
  const power = recurring.getByRole('listitem').filter({ hasText: 'Electricity (OVO)' });
  await expect(power).toContainText(/Me A?\$61\.50 · Sam A?\$61\.50 · Jo A?\$61\.50/);
  await expect(power).toContainText('1 payment not shared yet');
  await power.getByRole('button', { name: 'Share payment' }).click();
  await expect(power).toContainText('Last payment shared');
  await expect(page.getByRole('heading', { name: /My expense shares:.*61\.50/ })).toBeVisible();
  await expect(page.getByText(/^owes A?\$61\.50$/)).toHaveCount(2);
  await expect(page.getByText(/^is owed A?\$123$/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('bill splits, automatic sharing, people and one-off bills can all be changed', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Up Spending', 100000);
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const paid = await api.createTransaction({
    accountId: account.id,
    date: day(-5),
    amount: -10000,
    payeeName: 'Superloop',
  });
  const schedule = await api.call('POST', '/schedules', {
    name: 'Internet (Superloop)',
    amount: -10000,
    recurrenceType: 'monthly',
    recurrenceRule: { type: 'monthly', interval: 1, anchorDay: 1 },
    startDate: day(-5),
    accountId: account.id,
    payeeId: paid.payeeId,
  });
  const group = await api.call('POST', '/households', {
    name: 'Home',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Sam'],
    selfIndex: 0,
  });
  await api.call('POST', `/households/${group.group.id}/recurring-bills`, {
    scheduleIds: [schedule.id],
  });
  await api.call('POST', `/households/${group.group.id}/bills`, {
    description: 'Council rates',
    dueDate: day(30),
    amount: 30000,
  });
  await open(page, '/household');

  // People: add Jo, rename Sam
  await page.getByRole('button', { name: 'Add person' }).click();
  await page.getByLabel("New person's name").fill('Jo');
  await page.getByRole('button', { name: 'Add to household' }).click();
  await expect(page.getByRole('button', { name: 'Rename Jo' })).toBeVisible();
  await page.getByRole('button', { name: 'Rename Sam' }).click();
  await page.getByLabel('New name for Sam').fill('Samantha');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rename Samantha' })).toBeVisible();

  // A split of its own for the internet bill, then share its payment with it
  const recurring = page.getByRole('region', { name: 'Recurring bills' });
  const net = recurring.getByRole('listitem').filter({ hasText: 'Internet (Superloop)' });
  await expect(net).toContainText("household's default split");
  await net.getByRole('button', { name: 'Change split' }).click();
  await net.getByLabel('Split').selectOption('percentage');
  await net.getByLabel("Me's percentage").fill('50');
  await net.getByLabel("Samantha's percentage").fill('25');
  await net.getByLabel("Jo's percentage").fill('25');
  await net.getByRole('button', { name: 'Save split' }).click();
  await expect(net).toContainText(/Me A?\$50 · Samantha A?\$25 · Jo A?\$25/);
  await expect(net).toContainText('Me 50%, Samantha 25%, Jo 25%');
  await net.getByRole('button', { name: 'Share payment' }).click();
  await expect(net).toContainText('Last payment shared');
  const state = await api.call('GET', `/households/${group.group.id}`);
  const entry = state.events.find((e: any) => e.transactionId === paid.id);
  expect(entry.shares.map((s: any) => s.amount)).toEqual([5000, 2500, 2500]);

  // Automatic sharing of new payments
  await net.getByLabel('Share new payments automatically').click();
  await expect(net.getByLabel('Share new payments automatically')).toBeChecked();
  await expect(net).toContainText('(from ');
  const next = await api.createTransaction({
    accountId: account.id,
    date: day(0),
    amount: -10000,
    payeeName: 'Superloop',
  });
  const after = await api.call('GET', `/households/${group.group.id}`);
  expect(after.events.some((e: any) => e.transactionId === next.id)).toBe(true);

  // One-off bill: edit, then delete
  const bills = page.getByRole('heading', { name: 'Bills to reserve for' }).locator('..');
  await bills.getByRole('button', { name: 'Edit Council rates' }).click();
  await bills.getByLabel('Bill name').first().fill('Council rates Q2');
  await bills.getByLabel('Total', { exact: true }).fill('310.00');
  await bills.getByRole('button', { name: 'Save bill' }).click();
  await expect(bills).toContainText('Council rates Q2');
  await expect(bills).toContainText(/A?\$310/);
  await bills.getByRole('button', { name: 'Delete Council rates Q2…' }).click();
  await bills.getByRole('button', { name: 'Delete Council rates Q2', exact: true }).click();
  await expect(bills).toHaveCount(0);
});

test('a rent with fixed amounts from the household account shows what each owes the account', async ({
  page,
  api,
}) => {
  const joint = await api.createAccount('2Up Bills', 0);
  const mine = await api.createAccount('Up Spending', 100000);
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const rent = await api.createTransaction({
    accountId: joint.id,
    date: day(-3),
    amount: -300000,
    payeeName: 'Ray White',
  });
  const schedule = await api.call('POST', '/schedules', {
    name: 'Rent',
    amount: -300000,
    recurrenceType: 'monthly',
    recurrenceRule: { type: 'monthly', interval: 1, anchorDay: 1 },
    startDate: day(-3),
    accountId: joint.id,
    payeeId: rent.payeeId,
  });
  const group = await api.call('POST', '/households', {
    name: 'Rental',
    currency: 'AUD',
    accountId: joint.id,
    people: ['Me', 'Juno', 'Zephyr'],
    selfIndex: 0,
  });
  await api.call('POST', `/households/${group.group.id}/recurring-bills`, {
    scheduleIds: [schedule.id],
  });
  await open(page, '/household');

  const recurring = page.getByRole('region', { name: 'Recurring bills' });
  const bill = recurring.getByRole('listitem').filter({ hasText: 'Rent' });
  await bill.getByRole('button', { name: 'Change split' }).click();
  await bill.getByLabel('Split').selectOption('exact');
  await bill.getByLabel("Me's amount").fill('1200');
  await bill.getByLabel("Juno's amount").fill('1000');
  await bill.getByLabel("Zephyr's amount").fill('700');
  await expect(bill).toContainText(/expected to be A?\$3,000/);
  await bill.getByLabel("Zephyr's amount").fill('800');
  await expect(bill).toContainText(/Adds up to A?\$3,000\./);
  await bill.getByRole('button', { name: 'Save split' }).click();
  await expect(bill).toContainText(/Me A?\$1,200, Juno A?\$1,000, Zephyr A?\$800/);

  // The household account paid before anyone put their part in: each owes the account
  await bill.getByRole('button', { name: 'Share payment' }).click();
  await expect(bill).toContainText('Last payment shared');
  await expect(page.getByText(/^owes the household account A?\$1,200$/)).toBeVisible();
  await expect(page.getByText(/^owes the household account A?\$800$/)).toBeVisible();

  // My transfer into the account is offered as my contribution
  await api.call('POST', '/transactions/transfer', {
    fromAccountId: mine.id,
    toAccountId: joint.id,
    amount: 120000,
    toAmount: 120000,
    date: day(-1),
  });
  await page.reload();
  const sharing = page.getByRole('region', { name: 'Sharing' });
  await sharing.getByRole('button', { name: 'Record your contribution' }).click();
  await expect(page.getByText(/^owes the household account A?\$1,200$/)).toHaveCount(0);
});

test('lists who should pay whom and records a suggested repayment in one click', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Joint', 0, 'checking', { currency: 'AUD' });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: account.id,
    people: ['Me', 'Alex', 'Sam'],
    selfIndex: 0,
  });
  const alex = group.people.find((p: any) => p.name === 'Alex');
  // Alex paid $90 for all three: Me and Sam each owe Alex $30
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: '2026-10-21',
    description: 'Groceries',
    amount: 9000,
    payerId: alex.id,
    shares: group.people.map((p: any) => ({ personId: p.id, value: 1 })),
  });
  await open(page, '/household');
  const list = page.getByRole('list', { name: 'Suggested repayments' });
  await expect(list.getByText('You pay Alex A$30')).toBeVisible();
  await expect(list.getByText('Sam pays Alex A$30')).toBeVisible();
  await page.getByRole('button', { name: 'Record: Sam pays Alex A$30' }).click();
  await expect(list.getByText('Sam pays Alex A$30')).toHaveCount(0);
  await expect(list.getByText('You pay Alex A$30')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Record: You pay Alex A$30' }).click();
  await expect(page.getByRole('list', { name: 'Suggested repayments' })).toHaveCount(0);
});

test('edits an entry in place, and the activity log keeps what was changed and removed', async ({
  page,
  api,
}) => {
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    people: ['Me', 'Alex', 'Sam'],
    selfIndex: 0,
  });
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: '2026-10-21',
    description: 'Groceries',
    amount: 9000,
    payerId: group.people[0].id,
    shares: group.people.map((p: any) => ({ personId: p.id, value: 1 })),
  });
  await open(page, '/household');
  await page.getByRole('button', { name: /^All contributions, payments & repayments/ }).click();
  await page.getByRole('button', { name: 'Edit Groceries' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit entry' });
  await dialog.getByLabel('Description').fill('Groceries and bread');
  await typeAmount(dialog.getByLabel('Amount', { exact: true }), '96.00');
  await dialog.getByLabel('Split', { exact: true }).selectOption('equal');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  const history = page
    .getByRole('row', { name: /Groceries and bread/ })
    .filter({ has: page.getByRole('button', { name: 'Remove entry' }) });
  await expect(history).toContainText('A$96');

  await page.getByRole('button', { name: 'Remove entry' }).click();
  await expect(history).toHaveCount(0);
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  const log = page.getByRole('list', { name: 'Household activity' });
  await expect(log.getByText(/^Removed “Groceries and bread”/)).toBeVisible();
  await expect(log.getByText(/^Changed “Groceries and bread” \(description, amount/)).toBeVisible();
  await expect(log.getByText(/^Shared “Groceries”/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

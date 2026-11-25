import { test, expect, open } from './fixtures';

test('account links and group disclosures work from the keyboard', async ({ page, api }) => {
  const account = await api.createAccount('Keyboard spending', 125_000);
  await open(page, '/accounts');
  const main = page.getByRole('main');
  const group = main.getByRole('button', { name: /^Cash/ });
  const accountLink = main.getByRole('link', { name: /Keyboard spending/ });
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await group.focus();
  await page.keyboard.press('Enter');
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(accountLink).toBeHidden();
  await page.keyboard.press('Space');
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(accountLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/accounts/${account.id}$`));
});

for (const width of [390, 430]) {
  test(`accounts lead the phone layout and group headers fit at ${width}px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await api.createAccount('Phone spending', 125_000);
    await api.createAccount('Phone super', 8_252_931, 'retirement');
    await open(page, '/accounts');
    const main = page.getByRole('main');
    const accountLink = main.getByRole('link', { name: /Phone spending/ });
    await expect(accountLink).toBeInViewport({ ratio: 1 });
    await expect(main.getByRole('group', { name: 'Net worth period' })).toBeHidden();
    const disclosure = main.getByRole('button', { name: 'Show overview' });
    await disclosure.click();
    await expect(main.getByRole('button', { name: 'Hide overview' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(main.getByRole('group', { name: 'Net worth period' })).toBeVisible();
    // The chart's card is a direct child of the overview, without another card around it.
    const period = main.getByRole('group', { name: 'Net worth period' });
    expect(
      await period.evaluate((el) => {
        const card = el.closest('.shadow-card');
        return card?.parentElement?.getAttribute('data-guide');
      }),
    ).toBe('accounts.summary');
    await main.getByRole('button', { name: 'Hide overview' }).click();
    const superGroup = main.getByRole('button', { name: /^Superannuation/ });
    await superGroup.scrollIntoViewIfNeeded();
    expect(
      await superGroup.evaluate((el) => {
        const right = el.getBoundingClientRect().right;
        return [...el.querySelectorAll('span')].every(
          (child) => child.getBoundingClientRect().right <= right,
        );
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('an account loading failure offers retry instead of first-account guidance', async ({
  page,
  api,
}) => {
  test.info().annotations.push({
    type: 'allow-page-errors',
    description: 'Deliberate 422 account response',
  });
  await api.createAccount('Recovered spending', 125_000);
  let fail = true;
  await page.route('**/api/accounts', async (route) => {
    if (fail)
      await route.fulfill({ status: 422, json: { error: 'Accounts temporarily unavailable' } });
    else await route.continue();
  });
  await open(page, '/accounts');
  const main = page.getByRole('main');
  await expect(main.getByRole('alert')).toContainText('Couldn’t load your accounts.');
  await expect(main.getByText('Add the accounts you want to track')).toHaveCount(0);
  fail = false;
  await main.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(main.getByRole('link', { name: /Recovered spending/ })).toBeVisible();
  await expect(main.getByRole('alert')).toHaveCount(0);
});

test('a successfully loaded empty budget still offers first-account guidance', async ({ page }) => {
  await open(page, '/accounts');
  await expect(
    page.getByRole('main').getByText('Add the accounts you want to track'),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

for (const width of [390, 1512]) {
  test(`account types show personal, off-budget and household scope at ${width}px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 932 });
    await api.createAccount('Personal spending', 125_000);
    await api.createAccount('Tracked shares', 80_000, 'investment');
    const joint = await api.createAccount('Joint spending', 50_000, 'checking', {
      currency: 'AUD',
    });
    const householdName = 'Home with Alex and a longer household name';
    await api.call('POST', '/households', {
      name: householdName,
      currency: 'AUD',
      accountId: joint.id,
      people: ['Me', 'Alex'],
      selfIndex: 0,
    });
    await open(page, '/accounts');
    const main = page.getByRole('main');
    const personal = main.getByRole('link', { name: /Personal spending/ });
    const shares = main.getByRole('link', { name: /Tracked shares/ });
    const household = main.getByRole('link', { name: /Joint spending/ });
    await expect(personal).toContainText('For budget');
    await expect(shares).toContainText('Off budget');
    await expect(household).toContainText(`Household: ${householdName}`);
    await expect(household).not.toContainText('For budget');
    await expect(household).not.toContainText('Off budget');
    expect(await household.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    // Keyboard focus is covered above; here verify wrapped context leaves the row navigable.
    await household.click();
    await expect(page).toHaveURL(new RegExp(`#/accounts/${joint.id}$`));
  });
}

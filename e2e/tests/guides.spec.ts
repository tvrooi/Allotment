import { test, expect, open, type Api } from './fixtures';
import { GUIDES } from '../../client/src/guides';

// Guides and tips (docs/GUIDES.md). Progress is stored per person in the budget, outside
// backups, so the database reset between tests doesn't touch it: each test here puts it back
// to a new budget's (the welcome tour offered, tips held until it's decided).

async function newBudgetGuides(api: Api) {
  await api.call('POST', '/guides/reset');
  await api.call('PUT', '/guides', { tipsEnabled: true, pageGuidesEnabled: true });
}

test.beforeEach(async ({ api }) => {
  await newBudgetGuides(api);
  await api.createAccount('Everyday Checking', 100_000);
});
test.afterEach(async ({ api }) => newBudgetGuides(api));

test('a new budget is offered the welcome tour, which walks through the basics', async ({
  page,
  api,
}) => {
  await open(page, '/dashboard');
  const banner = page.getByRole('region', { name: 'Guide' });
  await expect(banner).toContainText('New to Allotment?');
  // Tips wait until the tour is decided
  await expect(page.getByRole('note', { name: 'Tip' })).toHaveCount(0);

  await banner.getByRole('button', { name: 'Take the tour' }).click();
  const tour = page.getByRole('dialog');
  await expect(tour.getByRole('heading', { name: 'Welcome to Allotment' })).toBeFocused();
  await expect(banner).toBeHidden();
  await tour.getByRole('button', { name: 'Start tour' }).click();

  await expect(tour.getByRole('heading', { name: 'Find your way around' })).toBeVisible();
  // The page behind can't be used while the tour is open
  await expect(page.locator('#root')).toHaveAttribute('inert', '');

  const titles = [
    'Your accounts',
    'Transactions',
    'Ready to assign',
    'Categories are envelopes',
    'Cover overspending',
    'Review',
    'Bills and pay',
    'Your dashboard',
    'Hide amounts',
    'Guides and tips',
  ];
  for (const title of titles) {
    await page.keyboard.press('ArrowRight');
    await expect(tour.getByRole('heading', { name: title })).toBeVisible();
    if (title === 'Your accounts') await expect(page).toHaveURL(/#\/accounts$/);
    if (title === 'Ready to assign') await expect(page).toHaveURL(/#\/budget$/);
  }
  await expect(tour).toContainText('Step 12 of 12');
  await tour.getByRole('button', { name: 'Done' }).click();
  await expect(tour).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('inert');

  const progress = await api.call('GET', '/guides');
  expect(progress).toMatchObject({ welcomeTour: 'done', seenGuides: { welcome: 1 } });
  await expect(banner).toBeHidden();
});

test('leaving the tour, tips and a page’s own guide', async ({ page, api }) => {
  await open(page, '/dashboard');
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await api.call('GET', '/guides')).toMatchObject({ welcomeTour: 'dismissed' });

  // Now tips show, once each
  const tip = page.getByRole('note', { name: 'Tip' });
  await expect(tip).toContainText('Alt+Shift+H');
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toBeHidden();
  expect((await api.call('GET', '/guides')).dismissedTips).toEqual(['dashboard.safe-mode-key']);

  // The budget's guide is offered on a first visit
  await open(page, '/budget');
  const banner = page.getByRole('region', { name: 'Guide' });
  await expect(banner).toContainText('First time here?');
  await banner.getByRole('button', { name: 'Show me' }).click();
  const guide = page.getByRole('dialog');
  await expect(guide.getByRole('heading', { name: 'Start with Ready to assign' })).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(guide).toBeHidden();
  await expect(banner).toBeHidden();
  expect((await api.call('GET', '/guides')).seenGuides).toEqual({ welcome: 1, budget: 1 });
});

test('guides can be found again, and tips turned off', async ({ page, api }) => {
  await api.call('PUT', '/guides', { welcomeTour: 'done', seenGuides: { welcome: 1 } });
  await open(page, '/budget');

  await page.getByRole('button', { name: 'Help and guides' }).click();
  const menu = page.getByRole('group', { name: 'Help and guides' });
  await menu.getByRole('button', { name: 'Guide for this page' }).click();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(
    'Start with Ready to assign',
  );
  await page.keyboard.press('Escape');

  // ? opens every guide, with the tip settings
  await page.keyboard.press('?');
  const list = page.getByRole('dialog', { name: 'Guides and tips' });
  await expect(list.getByRole('button', { name: 'Take again: Welcome tour' })).toBeVisible();
  await list.getByRole('group', { name: 'Show tips' }).getByRole('button', { name: 'Off' }).click();
  await expect.poll(async () => (await api.call('GET', '/guides')).tipsEnabled).toBe(false);
  await list.getByRole('button', { name: 'Take again: Welcome tour' }).click();
  await expect(list).toBeHidden();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('Welcome to Allotment');
  await page.keyboard.press('Escape');

  // The same settings are in Preferences
  await open(page, '/settings?tab=preferences');
  const section = page.getByRole('region', { name: 'Guides and tips' });
  await expect(
    section.getByRole('group', { name: 'Show tips' }).getByRole('button', { name: 'Off' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('every page guide opens from its page and finds what it points at', async ({ page, api }) => {
  test.setTimeout(120_000);
  await api.call('PUT', '/guides', { welcomeTour: 'done', seenGuides: { welcome: 1 } });
  const [account] = await api.accounts();
  await api.createTransaction({
    accountId: account.id,
    date: new Date().toISOString().slice(0, 10),
    amount: -1_500,
    payeeName: 'Corner Grocery',
  });
  // Parts of a page that need data a new budget doesn't have (an Afterpay account, an
  // investment account, a household): those steps show in the middle of the screen instead
  const needsData = new Set([
    'plans.earlier',
    'investments.add',
    'household.people',
    'household.bills',
    'household.record',
  ]);

  const pageGuides = GUIDES.filter((g) => g.page);
  expect(pageGuides.length).toBeGreaterThanOrEqual(14);
  for (const guide of pageGuides) {
    await open(page, guide.page!);
    await page.getByRole('button', { name: 'Help and guides' }).click();
    await page
      .getByRole('group', { name: 'Help and guides' })
      .getByRole('button', { name: 'Guide for this page' })
      .click();
    const tour = page.getByTestId('guide-tour');
    const card = page.getByRole('dialog');
    for (const [i, step] of guide.steps.entries()) {
      await expect(card.getByRole('heading', { name: step.title })).toBeVisible();
      await expect(card).toContainText(`Step ${i + 1} of ${guide.steps.length}`);
      const targets = step.target ? [step.target].flat() : [];
      const expected = targets.some((t) => !needsData.has(t)) ? 'found' : 'missing';
      await expect(tour, `${guide.id}: ${step.title}`).toHaveAttribute('data-target', expected);
      await card
        .getByRole('button', { name: i === guide.steps.length - 1 ? 'Done' : 'Next' })
        .click();
    }
    await expect(tour).toBeHidden();
  }
  const seen = (await api.call('GET', '/guides')).seenGuides;
  for (const guide of pageGuides) expect(seen[guide.id], guide.id).toBe(guide.version);
});

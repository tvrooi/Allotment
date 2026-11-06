import { test, expect, open } from './fixtures';
import { sidewaysOverflow } from './phone/overflow';

// Allotment's own user guide (/guide, client/src/userGuide/articles.tsx): its contents, and the
// pages linking to the article that explains them. That every article exists and is linked from
// somewhere is checked by the client's articles.test.ts.

test('the contents list the articles, and an article links to a related one', async ({ page }) => {
  await open(page, '/guide');
  await expect(page.getByRole('heading', { name: 'The Allotment guide' })).toBeVisible();
  for (const title of ['Payday plans', 'Card payments', 'Budget review', 'Long-term forecast'])
    await expect(page.getByRole('link', { name: new RegExp(`^${title}`) })).toBeVisible();
  // Budgeting points on to payday plans and card payments
  await open(page, '/guide/budgeting');
  await page.getByRole('link', { name: 'How payday plans work' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Payday plans' })).toBeVisible();
  await expect(page).toHaveURL(/\/guide\/payday-plans$/);
});

test('each page links to its guide article', async ({ page, api }) => {
  test.setTimeout(90_000);
  // A credit card shows the budget's Card payments panel
  await api.createAccount('Everyday', 100_000);
  await api.createAccount('Daily card', 0, 'credit');
  const article = (title: string) => page.getByRole('heading', { level: 1, name: title });

  await open(page, '/review');
  await page.getByRole('link', { name: 'How the review works' }).click();
  await expect(article('Budget review')).toBeVisible();

  await open(page, '/forecast');
  await page.getByRole('link', { name: 'How the long-term forecast works' }).click();
  await expect(article('Long-term forecast')).toBeVisible();
  // The link is about the long-term tab, so the cash runway doesn't show it
  await open(page, '/forecast?tab=cash');
  await expect(page.getByRole('link', { name: 'How the long-term forecast works' })).toHaveCount(0);

  await open(page, '/budget');
  await page.getByRole('link', { name: 'How card payments work' }).click();
  await expect(article('Card payments')).toBeVisible();

  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).first().click();
  await page.getByRole('link', { name: 'How payday plans work' }).click();
  await expect(article('Payday plans')).toBeVisible();

  for (const [route, name, title] of [
    ['/tax', 'How Tax time works', 'Tax time'],
    ['/reports', 'How reports work', 'Reports'],
    ['/settings?tab=data', 'How backups work', 'Backups'],
  ] as const) {
    await open(page, route);
    await page.getByRole('link', { name }).click();
    await expect(article(title), route).toBeVisible();
  }
});

test('on a phone the header links are 44 px tall and the pages keep their width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, name] of [
    ['/forecast', 'How the long-term forecast works'],
    ['/reports', 'How reports work'],
  ] as const) {
    await open(page, route);
    const link = page.getByRole('link', { name });
    await expect(link).toBeVisible();
    expect((await link.boundingBox())!.height, route).toBeGreaterThanOrEqual(44);
    expect(await sidewaysOverflow(page), route).toEqual([]);
  }
});

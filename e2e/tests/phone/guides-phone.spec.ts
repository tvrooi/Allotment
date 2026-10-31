import { test, expect, open, type Api } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// The welcome tour on a phone: a sheet at the screen's edge, pointing at the menu button
// instead of the sidebar. Progress is put back to a new budget's afterwards (see guides.spec.ts).

async function newBudgetGuides(api: Api) {
  await api.call('POST', '/guides/reset');
  await api.call('PUT', '/guides', { tipsEnabled: true, pageGuidesEnabled: true });
}

test.afterEach(async ({ api }) => newBudgetGuides(api));

test('the welcome tour works on a phone', async ({ page, api }) => {
  await newBudgetGuides(api);
  await api.createAccount('Everyday Checking', 100_000);
  await open(page, '/dashboard');
  await page
    .getByRole('region', { name: 'Guide' })
    .getByRole('button', { name: 'Take the tour' })
    .tap();

  const tour = page.getByRole('dialog');
  await tour.getByRole('button', { name: 'Start tour' }).tap();
  await expect(tour).toContainText('menu at the top left');

  for (let step = 3; step <= 12; step++) {
    await tour.getByRole('button', { name: 'Next' }).tap();
    await expect(tour).toContainText(`Step ${step} of 12`);
    expect(await sidewaysOverflow(page)).toEqual([]);
    // A sheet, never wider than the screen
    const box = (await tour.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await expect(tour).toContainText('In the menu, the ? button');
  await tour.getByRole('button', { name: 'Done' }).tap();
  await expect(tour).toBeHidden();
  expect(await api.call('GET', '/guides')).toMatchObject({ welcomeTour: 'done' });
});

import type { Page, TestInfo } from '@playwright/test';
import { test, expect, open, isoDay } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// The long-term forecast on a phone-sized screen (the "phone" project): every section and an
// event editor, with a realistic plan, must fit without scrolling sideways.

const LT = '/forecast/long-term';

async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`phone-${name}.png`), fullPage: true });
}

test('the long-term forecast fits a phone screen', async ({ page, api }, testInfo) => {
  test.setTimeout(120_000);
  const year = new Date().getFullYear();
  const checking = await api.createAccount('Everyday Checking', 1_250_000);
  const shares = await api.createAccount('Index Shares', 8_000_000, 'investment');
  await api.createAccount('Retirement Fund', 31_000_000, 'retirement');
  const mortgage = await api.createAccount('Home Loan', -42_000_000, 'mortgage');
  await api.call('PUT', `${LT}/loans/${mortgage.id}`, {
    rateBps: 620,
    monthlyRepayment: 260_000,
    termMonths: 300,
  });
  await api.call('POST', '/payday', {
    name: 'Fortnightly pay',
    anchorDate: isoDay(3),
    expectedIncome: 310_000,
    weekendAdjust: 'none',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    rules: [],
  });
  const base = {
    birthYear: year - 38,
    income: { takeHome: null, grossForSuper: 11_000_000, escalation: { mode: 'inflation' } },
  };
  const plan = (name: string, extra: object = {}) => ({
    name,
    settings: base,
    accounts: [],
    splits: [
      { accountId: checking.id, mode: 'fixed', amount: 500_000 },
      { accountId: shares.id, mode: 'percent', bps: 6000 },
    ],
    events: [
      {
        id: 'ret',
        kind: 'retirement',
        name: 'Retire at 62',
        enabled: true,
        start: { age: 62 },
        spendingMultiplierBps: 7500,
        reductions: { salary: 10000 },
      },
      {
        id: 'kid',
        kind: 'child',
        name: 'Our first child',
        enabled: true,
        start: { year: year + 2 },
        years: 18,
        annualCost: 1_500_000,
        upfrontCost: 400_000,
        escalation: { mode: 'inflation' },
      },
      {
        id: 'pay',
        kind: 'payOff',
        name: 'Pay off the home loan',
        enabled: true,
        start: { year: year + 12 },
        loanId: mortgage.id,
        amount: null,
      },
      {
        id: 'job',
        kind: 'newJob',
        name: 'A much longer name for a new job with more pay',
        enabled: true,
        start: { year: year + 4 },
        takeHome: 14_000_000,
        escalation: { mode: 'inflation' },
        signingBonus: 0,
        grossSalary: 17_000_000,
        reductions: { salary: 10000 },
      },
    ],
    ...extra,
  });
  await api.call('POST', `${LT}/plans`, { plan: plan('Main plan') });
  await api.call('POST', `${LT}/plans`, {
    plan: plan('Retire later', {
      events: [
        {
          id: 'ret',
          kind: 'retirement',
          name: 'Retire at 67',
          enabled: true,
          start: { age: 67 },
          spendingMultiplierBps: 7500,
          reductions: { salary: 10000 },
        },
      ],
    }),
  });

  const problems: string[] = [];
  const check = async (name: string) => {
    await page.waitForLoadState('networkidle');
    await shot(page, testInfo, name);
    const overflow = await sidewaysOverflow(page);
    if (overflow.length) problems.push(`${name}: ${overflow.join('; ')}`);
  };

  await open(page, '/forecast');
  await expect(page.getByText('Net worth today', { exact: true })).toBeVisible();
  await check('long-term');
  await page.getByLabel('Year', { exact: true }).selectOption({ index: 3 });
  await expect(page.getByText('The parts add up to the change, to the cent')).toBeVisible();
  await check('long-term-year');
  for (const tab of ['Assumptions', 'Accounts', 'Savings']) {
    await page.getByRole('tab', { name: tab }).click();
    await check(`long-term-${tab.toLowerCase()}`);
  }
  await page.getByRole('tab', { name: 'Compare' }).click();
  await page.getByLabel('Compare with').selectOption({ label: 'Retire later' });
  await expect(page.getByRole('region', { name: 'Comparison' })).toBeVisible();
  await check('long-term-compare');
  await page.getByRole('tab', { name: 'Simulation' }).click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByLabel('Chance of success')).toBeVisible();
  await check('long-term-simulation');
  await page.getByRole('tab', { name: 'Life events' }).click();
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('button', { name: /^Buy a home/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check('long-term-home-editor');
  expect(problems, 'long-term sections that scroll sideways on a phone').toEqual([]);
});

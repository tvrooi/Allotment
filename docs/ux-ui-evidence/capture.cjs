const { chromium } = require('/workspace/Allotment/e2e/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const root = '/workspace/Allotment/docs/ux-ui-evidence';
  let out = [];
  const routes = [
    'welcome',
    'dashboard',
    'budget',
    'budget/year',
    'accounts',
    'transactions',
    'household',
    'payment-plans',
    'recurring',
    'cash-flow',
    'reports',
    'reports/custom',
    'payees',
    'rules',
    'settings',
    'goals',
    'forecast',
    'investments',
    'tax',
    'files',
    'review',
    'guide',
  ];
  for (const width of [1440, 390, 320]) {
    await p.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    for (const route of routes) {
      await p.goto('http://localhost:5173/#/' + route);
      await p.waitForTimeout(600);
      const name = route.replaceAll('/', '-') + '-' + width + '-demo';
      await p.screenshot({ path: root + '/' + name + '.png', fullPage: true });
      const body = await p.locator('body').innerText();
      fs.writeFileSync(root + '/' + name + '.txt', body);
      out.push({
        route,
        width,
        url: p.url(),
        overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        screenshot: name + '.png',
      });
    }
  }
  fs.writeFileSync(root + '/captures.json', JSON.stringify(out, null, 2));
  await b.close();
})();

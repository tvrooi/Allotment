const { chromium } = require('/workspace/Allotment/e2e/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:5173/#/goals');
  await p.waitForTimeout(2500);
  console.log(await p.locator('body').innerText());
  const add = p.getByRole('button', { name: 'Add goal', exact: true });
  await add.click();
  await p.screenshot({ path: '/workspace/Allotment/docs/ux-ui-evidence/goal-dialog-390.png' });
  let evidence = {
    initial: await p.evaluate(() => ({
      tag: document.activeElement.tagName,
      text: document.activeElement.textContent,
      inside: !!document.activeElement.closest('[role=dialog]'),
    })),
  };
  await p.keyboard.press('Tab');
  evidence.afterTab = await p.evaluate(() => ({
    tag: document.activeElement.tagName,
    text: document.activeElement.textContent,
    inside: !!document.activeElement.closest('[role=dialog]'),
  }));
  evidence.tabWalk = [];
  for (let i = 0; i < 18; i++) {
    await p.keyboard.press('Tab');
    evidence.tabWalk.push(
      await p.evaluate(() => ({
        tag: document.activeElement.tagName,
        text: document.activeElement.textContent.slice(0, 80),
        inside: !!document.activeElement.closest('[role=dialog]'),
      })),
    );
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  evidence.closed = await p.getByRole('dialog').count();
  fs.writeFileSync(
    '/workspace/Allotment/docs/ux-ui-evidence/dialog-keyboard.json',
    JSON.stringify(evidence, null, 2),
  );
  await b.close();
})();

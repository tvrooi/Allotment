// Real Electron + real Allotment server, using disposable profiles and no bank token.
// Run after compile:electron and build:server:bundle; pass a built web client as argv[2].
const { _electron, expect } = require('../e2e/node_modules/playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const client = path.resolve(
  process.argv[2] || path.join(os.tmpdir(), 'flybudget-e2e-cache-client-web'),
);
assert.ok(fs.existsSync(path.join(client, 'index.html')), 'Pass a built web client directory');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-desktop-remote-'));
const profile = path.join(temporary, 'desktop');
fs.mkdirSync(profile);
// A copy, so the test can play an older server by removing the Mac window marker
const served = path.join(temporary, 'client');
fs.cpSync(client, served, { recursive: true });
const harness = path.join(temporary, 'launch.cjs');
fs.writeFileSync(
  harness,
  `const {app}=require('electron');
app.setPath('userData', ${JSON.stringify(profile)});
app.relaunch=()=>{};
require(${JSON.stringify(path.join(__dirname, 'dist/main.js'))});`,
);

async function freePort() {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

let desktop;
let server;
let log = '';
const launch = async () => {
  const instance = await _electron.launch({
    executablePath: require('electron'),
    args: [harness],
    env: { ...process.env, ELECTRON_DEV: 'false' },
    timeout: 30_000,
  });
  return instance;
};

const isMac = process.platform === 'darwin';
// Whether the server window has no title bar: the page's Mac layout and the inset buttons
async function macWindow(page) {
  return {
    layout: await page.evaluate(() => document.documentElement.classList.contains('mac-window')),
    buttons: await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().startsWith('http://'),
      );
      return win.getWindowButtonPosition?.() ?? null;
    }),
  };
}

(async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, [path.join(__dirname, 'dist/server.js')], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_PROD: '',
      NODE_ENV: 'test',
      PORT: String(port),
      EXPRESS_PORT: String(port),
      FLYBUDGET_SERVER_MODE: 'true',
      FLYBUDGET_HOST: '127.0.0.1',
      FLYBUDGET_DATA_KEY: randomBytes(32).toString('base64'),
      DB_PATH: path.join(temporary, 'server.db'),
      CLIENT_DIST: served,
      MIGRATIONS_PATH: path.join(root, 'server/src/db/migrations'),
      NODE_PATH: path.join(root, 'server/node_modules'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => (log += chunk));
  server.stderr.on('data', (chunk) => (log += chunk));
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null) throw new Error(log);
        try {
          return (await fetch(url + 'api/health')).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);
  assert.equal((await fetch(url + 'api/accounts')).status, 401);

  desktop = await launch();
  const picker = await desktop.firstWindow();
  await expect(picker.getByRole('heading', { name: 'Where is your budget?' })).toBeVisible();
  await picker.getByLabel('Allotment server address').fill(url);
  await picker.getByRole('button', { name: 'Connect to server' }).click();
  await expect(picker.getByRole('alert')).toContainText('confirm that you trust');
  await picker.getByRole('checkbox').check();
  const closed = desktop.waitForEvent('close');
  await picker.getByRole('button', { name: 'Connect to server' }).click();
  await closed;
  desktop = null;
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile, 'connection.json'))), {
    mode: 'server',
    url,
    allowHttp: true,
  });

  desktop = await launch();
  const page = await desktop.firstWindow();
  await expect(page.getByRole('heading', { name: 'Set up your Allotment server' })).toBeVisible();
  const isolated = await page.evaluate(() => ({
    api: typeof window.__API_BASE__,
    ipc: typeof window.budgetLocation,
    node: typeof window.require,
  }));
  assert.deepEqual(isolated, { api: 'undefined', ipc: 'undefined', node: 'undefined' });
  const setupCode = log.match(/[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}/)?.[0];
  assert.ok(setupCode, 'The isolated server should print a setup code');
  await page.getByLabel('Setup code').fill(setupCode);
  await page.getByLabel('New password', { exact: true }).fill('Disposable-test-password-72');
  await page.getByLabel('Confirm password', { exact: true }).fill('Disposable-test-password-72');
  await page.getByRole('button', { name: 'Create password' }).click();
  await expect
    .poll(() => page.evaluate(async () => (await fetch('/api/accounts')).status))
    .toBe(200);
  const account = await page.evaluate(async () => {
    const result = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared server account', type: 'checking', onBudget: true }),
    });
    if (!result.ok) throw new Error(await result.text());
    return result.json();
  });
  await page.reload();
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  await expect(page.getByText('Shared server account', { exact: true }).first()).toBeVisible();
  assert.equal((await fetch(url + 'api/accounts')).status, 401, 'Other devices must still sign in');
  const auth = await fetch(url + 'api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Disposable-test-password-72' }),
  });
  const cookie = auth.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const accounts = await (
    await fetch(url + 'api/accounts', { headers: { Cookie: cookie } })
  ).json();
  assert.ok(
    accounts.some((item) => item.id === account.id),
    'A second device sees the desktop write in the server database',
  );
  assert.equal(fs.existsSync(path.join(profile, 'budget.db')), false);
  assert.equal(fs.existsSync(path.join(profile, 'credentials.key')), false);
  await desktop.close();
  desktop = await launch();
  const reopened = await desktop.firstWindow();
  await reopened.getByRole('link', { name: 'Accounts', exact: true }).click();
  await expect(reopened.getByText('Shared server account', { exact: true }).first()).toBeVisible();
  // macOS: this server's page draws the Mac layout, so its window has no title bar
  assert.deepEqual(
    await macWindow(reopened),
    isMac ? { layout: true, buttons: { x: 16, y: 14 } } : { layout: false, buttons: null },
  );
  await desktop.evaluate(({ Menu }) => {
    Menu.getApplicationMenu().getMenuItemById('budget-location').click();
  });
  await expect.poll(() => desktop.windows().length).toBe(2);
  const selector = desktop.windows().find((win) => win !== reopened);
  await expect(selector.getByLabel('Allotment server address')).toHaveValue(url);
  // Arbitrary web contents cannot invoke the local picker's IPC handler.
  assert.equal(
    await desktop.evaluate(async ({ webContents }) => {
      const windows = webContents.getAllWebContents();
      const remote = windows.find((contents) => contents.getURL().startsWith('http://'));
      return Boolean(remote.getLastWebPreferences().preload);
    }),
    false,
  );
  await desktop.close();
  // An older server's page doesn't draw the Mac layout: its window keeps the title bar
  const index = path.join(served, 'index.html');
  fs.writeFileSync(
    index,
    fs.readFileSync(index, 'utf8').replace(/<meta name="flybudget-mac-window"[^>]*>/, ''),
  );
  desktop = await launch();
  const older = await desktop.firstWindow();
  await expect(older.getByRole('link', { name: 'Accounts', exact: true })).toBeVisible();
  assert.deepEqual(await macWindow(older), { layout: false, buttons: null });
  await desktop.close();
  desktop = null;
  server.kill();
  await once(server, 'exit');
  server = null;
  // An uncached launch to an unavailable server must offer a way to recover.
  const offlineProfile = path.join(temporary, 'uncached-desktop');
  fs.mkdirSync(offlineProfile);
  fs.copyFileSync(
    path.join(profile, 'connection.json'),
    path.join(offlineProfile, 'connection.json'),
  );
  fs.writeFileSync(
    harness,
    fs
      .readFileSync(harness, 'utf8')
      .replace(JSON.stringify(profile), JSON.stringify(offlineProfile)),
  );
  desktop = await launch();
  await desktop.firstWindow();
  // The first window is replaced by the native picker after the failed navigation.
  await expect
    .poll(() => desktop.windows().some((win) => win.url().startsWith('data:')))
    .toBe(true);
  const recovery = desktop.windows().find((win) => win.url().startsWith('data:'));
  await expect(recovery.getByRole('alert')).toContainText('Could not reach the server');
  console.log(
    'PASS: native server picker, HTTP consent, isolated renderer, password login, shared writes, saved session, Mac title bar by server support, no local database/key, offline recovery.',
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (desktop) await desktop.close().catch(() => {});
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  });

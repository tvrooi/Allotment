const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { DesktopUpdates, signedMacIdentity, RELEASES_URL } = require('./dist/updates.js');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(eligible = true, choices = []) {
  const driver = new EventEmitter();
  Object.assign(driver, {
    checks: 0,
    downloads: 0,
    installs: 0,
    checkForUpdates: async () => {
      driver.checks++;
    },
    downloadUpdate: async () => {
      driver.downloads++;
      driver.emit('update-downloaded');
    },
    quitAndInstall: () => {
      driver.installs++;
    },
  });
  const messages = [];
  let opened = 0;
  const ui = {
    ask: async (message, detail, buttons) => {
      messages.push({ message, detail, buttons });
      return choices.shift() ?? buttons.length - 1;
    },
    openReleases: () => {
      opened++;
    },
  };
  return {
    driver,
    messages,
    get opened() {
      return opened;
    },
    updates: new DesktopUpdates(driver, ui, eligible),
  };
}
test('only verified Developer ID identities qualify; ad-hoc, tampered and other signing identities do not', () => {
  const identity =
    'Authority=Developer ID Application: Example (A123456789)\nTeamIdentifier=A123456789\n';
  assert.equal(signedMacIdentity(identity, true), true);
  assert.equal(signedMacIdentity(identity, false), false);
  assert.equal(signedMacIdentity('Signature=adhoc\nTeamIdentifier=not set', true), false);
  assert.equal(
    signedMacIdentity('Authority=Apple Development: Example\nTeamIdentifier=A123456789', true),
    false,
  );
  assert.equal(signedMacIdentity('Authority=Developer ID Application: Example', true), false);
});
test('unsupported builds never contact the updater, and silent startup does not prompt', async () => {
  const f = fixture(false, [0]);
  await f.updates.check(false);
  assert.equal(f.messages.length, 0);
  await f.updates.check();
  assert.equal(f.driver.checks, 0);
  assert.equal(f.opened, 1);
  assert.equal(RELEASES_URL, 'https://github.com/tvrooi/FlyBudget/releases');
});
test('an automatic check that cannot reach the feed stays quiet', async () => {
  const f = fixture();
  f.driver.checkForUpdates = async () => {
    throw Error('Network unavailable');
  };
  await f.updates.check(false);
  assert.equal(f.messages.length, 0);
  assert.equal(f.driver.installs, 0);
});
test('checks coalesce and never silently download, downgrade, install on quit or restart', async () => {
  const f = fixture();
  await f.updates.check();
  await f.updates.check();
  assert.equal(f.driver.checks, 1);
  assert.equal(f.driver.autoDownload, false);
  assert.equal(f.driver.autoInstallOnAppQuit, false);
  assert.equal(f.driver.allowDowngrade, false);
  assert.equal(f.driver.allowPrerelease, true);
  f.driver.emit('update-not-available');
  await tick();
  assert.equal(f.driver.downloads, 0);
  assert.equal(f.driver.installs, 0);
});
test('downloads only with consent, then keeps a ready update until restart is selected', async () => {
  const f = fixture(true, [0, 1, 0]);
  await f.updates.check();
  f.driver.emit('update-available', { version: '0.2.0-up.7' });
  await tick();
  assert.equal(f.driver.downloads, 1);
  assert.equal(f.driver.installs, 0);
  await f.updates.check();
  assert.equal(f.driver.installs, 1);
  assert.equal(f.driver.downloads, 1);
});
test('declining an available update leaves the installed application alone', async () => {
  const f = fixture(true, [1]);
  await f.updates.check();
  f.driver.emit('update-available', { version: '0.2.0-up.7' });
  await tick();
  assert.equal(f.driver.downloads, 0);
  assert.equal(f.driver.installs, 0);
  await f.updates.check();
  assert.equal(f.driver.checks, 2);
});
test('verification/network failure reports a safe error and cannot bypass verification', async () => {
  const f = fixture(true, [0, 0]);
  f.driver.downloadUpdate = async () => {
    throw Error('PRIVATE-TOKEN secret and untrusted release data');
  };
  await f.updates.check();
  f.driver.emit('update-available', { version: '0.2.0-up.7' });
  await tick();
  assert.equal(f.driver.installs, 0);
  assert.doesNotMatch(JSON.stringify(f.messages), /PRIVATE-TOKEN|secret/);
  assert.match(f.messages.at(-1).detail, /cannot be bypassed/);
  await f.updates.check();
  assert.equal(f.driver.checks, 2);
});
test('release configuration preserves ad-hoc PR builds, but fails closed on incomplete published Mac signing', () => {
  const name = require.resolve('../electron-builder.release.cjs');
  const keys = [
    'FLYBUDGET_MAC_SIGNING',
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const load = () => {
    delete require.cache[name];
    return require(name);
  };
  try {
    for (const k of keys) delete process.env[k];
    assert.equal(load().mac.identity, '-');
    process.env.FLYBUDGET_MAC_SIGNING = 'true';
    assert.throws(load, /CSC_LINK/);
    for (const k of keys.slice(1)) process.env[k] = 'synthetic-test-value';
    const signed = load();
    assert.equal(signed.mac.identity, undefined);
    assert.equal(signed.mac.hardenedRuntime, true);
    assert.equal(signed.mac.notarize, true);
    assert.equal(signed.forceCodeSigning, true);
    assert.deepEqual(signed.publish[0], {
      provider: 'github',
      owner: 'tvrooi',
      repo: 'FlyBudget',
      channel: 'up',
      releaseType: 'prerelease',
    });
    assert.ok(signed.mac.target.some((t) => t.target === 'zip'));
    assert.ok(signed.files.includes('electron/dist/desktopUpdates.js'));
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete require.cache[name];
  }
});

const {
  checkInstallerRelease,
  newerForkVersion,
  isForkInstaller,
} = require('./dist/releaseCheck.js');
test('unsigned release checks select only newer installers from this fork without authentication', async () => {
  const name = 'FlyBudget-macOS-arm64.dmg';
  const release = (tag, owner = 'tvrooi') => ({
    draft: false,
    tag_name: tag,
    assets: [
      {
        name,
        browser_download_url: `https://github.com/${owner}/FlyBudget/releases/download/${tag}/${name}`,
      },
    ],
  });
  const offer = await checkInstallerRelease(
    '0.2.0-up.6',
    'darwin',
    'arm64',
    async (url, options) => {
      assert.equal(url, 'https://api.github.com/repos/tvrooi/FlyBudget/releases?per_page=20');
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.redirect, 'error');
      return new Response(
        JSON.stringify([
          release('v0.2.0-up.7'),
          release('v0.2.0-up.99', 'other'),
          release('v0.2.0-up.8'),
          release('v0.2.0-up.5'),
        ]),
      );
    },
  );
  assert.equal(offer.version, '0.2.0-up.8');
  assert.equal(newerForkVersion('0.2.0-up.5', '0.2.0-up.6'), false);
  assert.equal(newerForkVersion('0.2.0', '0.2.0-up.6'), true);
  assert.equal(newerForkVersion('evil', '0.2.0-up.6'), false);
  assert.equal(isForkInstaller(offer.url + '?redirect=evil', 'v0.2.0-up.8', name), false);
  assert.equal(isForkInstaller('javascript:alert(1)', 'v0.2.0-up.8', name), false);
  await assert.rejects(
    checkInstallerRelease(
      '0.2.0-up.6',
      'darwin',
      'arm64',
      async () => new Response('', { status: 403 }),
    ),
  );
  await assert.rejects(
    checkInstallerRelease(
      '0.2.0-up.6',
      'darwin',
      'arm64',
      async () => new Response('x'.repeat(4 * 1024 * 1024 + 1)),
    ),
  );
});
test('unsigned packaged apps offer an installer without downloading or replacing themselves', async () => {
  const f = fixture(false, [0]);
  const urls = [];
  const ui = {
    ask: async (_message, _detail, buttons) => {
      assert.equal(buttons[0], 'Download installer');
      return 0;
    },
    openReleases() {},
    openInstaller: (url) => urls.push(url),
  };
  const updater = new DesktopUpdates(f.driver, ui, false, async () => ({
    version: '0.2.0-up.7',
    url: 'https://github.com/tvrooi/FlyBudget/releases/download/v0.2.0-up.7/FlyBudget-macOS-arm64.dmg',
  }));
  await updater.check();
  assert.equal(urls.length, 1);
  assert.equal(f.driver.checks, 0);
  assert.equal(f.driver.downloads, 0);
  assert.equal(f.driver.installs, 0);
});

test('unsigned configuration removes empty certificate variables instead of treating cwd as a certificate', () => {
  const { execFileSync } = require('node:child_process');
  const result = execFileSync(
    process.execPath,
    [
      '-e',
      "require('./electron-builder.release.cjs'); process.stdout.write(String(process.env.CSC_LINK))",
    ],
    {
      cwd: require('node:path').resolve(__dirname, '..'),
      env: { ...process.env, FLYBUDGET_MAC_SIGNING: 'false', CSC_LINK: '', CSC_KEY_PASSWORD: '' },
      encoding: 'utf8',
    },
  );
  assert.equal(result, 'undefined');
});

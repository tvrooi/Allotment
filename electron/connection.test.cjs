const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseLocation,
  loadLocation,
  saveLocation,
  serverPartition,
  sameOrigin,
} = require('./dist/connection.js');
const { connectionPage } = require('./dist/connectionPage.js');

test('server configuration rejects executable URLs, credentials and non-root destinations', () => {
  for (const url of [
    'javascript:alert(1)',
    'file:///tmp/budget',
    'data:text/html,hi',
    'https://me:secret@example.com',
    'https://example.com/api',
    'https://example.com/?token=secret',
    'https://example.com/#budget',
    'https://example.com/\\other',
    'https://exa\nmple.com',
  ]) {
    assert.throws(() => parseLocation({ mode: 'server', url, allowHttp: true }), url);
  }
  assert.throws(() => parseLocation({ mode: 'server', url: 'http://homeassistant.local:3001' }));
  assert.equal(
    parseLocation({ mode: 'server', url: 'https://Budget.Example:443' }).url,
    'https://budget.example/',
  );
  assert.equal(
    parseLocation({ mode: 'server', url: 'http://homeassistant.local:3001', allowHttp: true }).url,
    'http://homeassistant.local:3001/',
  );
});

test('server origins isolate sessions, and navigation cannot escape to another origin', () => {
  assert.equal(
    serverPartition('https://one.example/'),
    serverPartition('https://one.example:443/'),
  );
  assert.notEqual(serverPartition('https://one.example/'), serverPartition('https://two.example/'));
  assert.notEqual(serverPartition('http://one.example/'), serverPartition('https://one.example/'));
  assert.equal(sameOrigin('https://one.example/settings', 'https://one.example/'), true);
  for (const candidate of [
    'https://one.example.evil.test/',
    'https://one.example@evil.test/',
    'http://one.example/',
    'file:///tmp/test',
  ]) {
    assert.equal(sameOrigin(candidate, 'https://one.example/'), false);
  }
});

test('only the destination is persisted; invalid profiles fail instead of opening another budget', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-location-'));
  try {
    assert.equal(loadLocation(dir), null);
    saveLocation(dir, {
      mode: 'server',
      url: 'https://budget.example/',
      password: 'never-save-me',
    });
    const config = fs.readFileSync(path.join(dir, 'connection.json'), 'utf8');
    assert.equal(config.includes('never-save-me'), false);
    assert.deepEqual(loadLocation(dir), {
      mode: 'server',
      url: 'https://budget.example/',
      allowHttp: false,
    });
    assert.equal(fs.readdirSync(dir).length, 1);
    fs.writeFileSync(path.join(dir, 'connection.json'), '{broken');
    assert.throws(() => loadLocation(dir), /could not be read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('local picker escapes status text and has no network or arbitrary script permission', () => {
  const url = connectionPage(null, '<script>alert(1)</script>');
  const html = Buffer.from(url.split(',')[1], 'base64').toString();
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.ok(!html.includes('unsafe-inline'));
});

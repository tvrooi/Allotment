const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureCredentialKey, settings, smtpSettings } = require('./ha-launch.cjs');

test('the encryption key survives restarts and remains private', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-ha-key-'));
  try {
    const file = ensureCredentialKey(directory);
    const original = fs.readFileSync(file);
    ensureCredentialKey(directory);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.equal(Buffer.from(original.toString().trim(), 'base64').length, 32);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('a damaged key is never silently replaced', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-ha-key-'));
  try {
    const file = path.join(directory, 'credentials.key');
    fs.writeFileSync(file, 'damaged');
    assert.throws(() => ensureCredentialKey(directory), /has not been replaced/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'damaged');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('server mode, persistent storage and reverse proxy settings are explicit', () => {
  const env = settings({ allowed_hosts: 'budget.example.com', trust_proxy: true });
  assert.equal(env.FLYBUDGET_SERVER_MODE, 'true');
  assert.equal(env.FLYBUDGET_HOST_KIND, 'home-assistant');
  assert.equal(env.DB_PATH, '/data/flybudget/budget.db');
  assert.equal(env.FLYBUDGET_DATA_KEY_FILE, '/data/flybudget/credentials.key');
  assert.equal(env.FLYBUDGET_TRUST_PROXY, '1');
  assert.equal(settings({ allowed_hosts: '', trust_proxy: false }).FLYBUDGET_TRUST_PROXY, '');
  assert.throws(() => settings({ allowed_hosts: '', trust_proxy: 'false' }), /Invalid/);
});

test('multi-user mode is optional, and only a real yes or no', () => {
  // Installs from before the option keep working
  assert.doesNotThrow(() => settings({ allowed_hosts: '', trust_proxy: false }));
  const env = settings({ allowed_hosts: '', trust_proxy: false, multi_user: true });
  // The budget stays where it was, whichever mode starts it
  assert.equal(env.DB_PATH, '/data/flybudget/budget.db');
  assert.throws(
    () => settings({ allowed_hosts: '', trust_proxy: false, multi_user: 'yes' }),
    /multi_user/,
  );
});

test('the mail server for password codes is checked as a set, and stays out of the environment', () => {
  const base = { allowed_hosts: '', trust_proxy: false, multi_user: true };
  const smtp = {
    smtp_host: ' smtp.example.com ',
    smtp_port: 465,
    smtp_security: 'tls',
    smtp_username: 'allotment',
    smtp_password: ' a password with spaces ',
    smtp_from: 'allotment@example.com',
  };
  // Installs from before the options, and options cleared to empty: email is off
  assert.equal(smtpSettings(base), undefined);
  assert.equal(
    smtpSettings({ ...base, smtp_host: '', smtp_username: '', smtp_password: '' }),
    undefined,
  );
  assert.deepEqual(smtpSettings({ ...base, ...smtp }), {
    host: 'smtp.example.com',
    port: 465,
    security: 'tls',
    username: 'allotment',
    // A password is taken as typed
    password: ' a password with spaces ',
    from: 'allotment@example.com',
  });
  // A relay that needs no login
  const { smtp_username: _u, smtp_password: _p, ...open } = smtp;
  assert.equal(smtpSettings({ ...base, ...open, smtp_security: 'starttls' }).username, undefined);
  // A partial set says what is missing
  assert.throws(
    () => smtpSettings({ ...base, smtp_host: 'smtp.example.com' }),
    /smtp_port, smtp_security, smtp_from are empty/,
  );
  assert.throws(() => smtpSettings({ ...base, ...open, smtp_password: 'x' }), /together/);
  // Plain SMTP is never an option here
  assert.throws(() => smtpSettings({ ...base, ...smtp, smtp_security: 'none' }), /tls or starttls/);
  assert.throws(() => smtpSettings({ ...base, ...smtp, smtp_port: '465' }), /smtp_port/);
  assert.throws(() => smtpSettings({ ...base, ...smtp, smtp_from: 'Allotment' }), /smtp_from/);
  // Nothing about the mail server is in what goes into the environment
  const env = JSON.stringify(settings({ ...base, ...smtp }));
  assert.doesNotMatch(env, /smtp|a password with spaces/i);
});

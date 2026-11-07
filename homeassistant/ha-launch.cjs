const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

function ensureCredentialKey(directory) {
  const file = path.join(directory, 'credentials.key');
  try {
    // Exclusive creation: restarts and restored backups MUST keep the existing key.
    fs.writeFileSync(file, randomBytes(32).toString('base64') + '\n', { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  const stored = fs.readFileSync(file, 'utf8').trim();
  const bytes = Buffer.from(stored, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== stored) {
    throw new Error(
      'The saved credential encryption key is invalid. Restore it from a backup; it has not been replaced.',
    );
  }
  fs.chmodSync(file, 0o600);
  return file;
}

function settings(options, directory = '/data/flybudget') {
  if (
    !options ||
    typeof options.allowed_hosts !== 'string' ||
    typeof options.trust_proxy !== 'boolean' ||
    (options.multi_user !== undefined && typeof options.multi_user !== 'boolean')
  ) {
    throw new Error(
      'Invalid Home Assistant app configuration. Check allowed_hosts, trust_proxy and multi_user.',
    );
  }
  return {
    NODE_ENV: 'production',
    ELECTRON_PROD: 'true',
    FLYBUDGET_SERVER_MODE: 'true',
    FLYBUDGET_HOST_KIND: 'home-assistant',
    FLYBUDGET_HOST: '0.0.0.0',
    PORT: '3001',
    DB_PATH: path.join(directory, 'budget.db'),
    FLYBUDGET_DATA_KEY_FILE: path.join(directory, 'credentials.key'),
    FLYBUDGET_ALLOWED_HOSTS: options.allowed_hosts.trim(),
    FLYBUDGET_TRUST_PROXY: options.trust_proxy ? '1' : '',
    MIGRATIONS_PATH: '/app/migrations',
    CLIENT_DIST: '/app/client',
  };
}

const SMTP_OPTIONS = [
  'smtp_host',
  'smtp_port',
  'smtp_security',
  'smtp_username',
  'smtp_password',
  'smtp_from',
];

/**
 * The mail server for password codes in multi-user mode (docs/MULTI-USER-EMAIL-AND-REMINDERS.md),
 * checked as a set: all empty means email is off. It is passed to the gateway as a value,
 * never put in the environment, which every budget process inherits.
 */
function smtpSettings(options) {
  const value = (key) => {
    const v = options[key];
    if (v === undefined || v === null || v === '') return undefined;
    if (key === 'smtp_port' ? !Number.isInteger(v) : typeof v !== 'string')
      throw new Error(`Invalid Home Assistant app configuration. Check ${key}.`);
    return typeof v === 'string' && key !== 'smtp_password' ? v.trim() || undefined : v;
  };
  const set = Object.fromEntries(SMTP_OPTIONS.map((key) => [key, value(key)]));
  if (SMTP_OPTIONS.every((key) => set[key] === undefined)) return undefined;
  const missing = ['smtp_host', 'smtp_port', 'smtp_security', 'smtp_from'].filter(
    (key) => set[key] === undefined,
  );
  if (missing.length)
    throw new Error(
      `Email for password codes needs smtp_host, smtp_port, smtp_security and smtp_from; ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} empty. Fill them in, or clear every smtp_ option to turn email off.`,
    );
  if ((set.smtp_username === undefined) !== (set.smtp_password === undefined))
    throw new Error(
      'Email for password codes needs smtp_username and smtp_password together, or neither.',
    );
  if (set.smtp_security !== 'tls' && set.smtp_security !== 'starttls')
    throw new Error('smtp_security must be tls or starttls.');
  if (set.smtp_port < 1 || set.smtp_port > 65535)
    throw new Error('Invalid Home Assistant app configuration. Check smtp_port.');
  if (!/^[^\s@<>"]+@[^\s@<>"]+$/.test(set.smtp_from))
    throw new Error('smtp_from must be an email address, e.g. allotment@example.com.');
  return {
    host: set.smtp_host,
    port: set.smtp_port,
    security: set.smtp_security,
    username: set.smtp_username,
    password: set.smtp_password,
    from: set.smtp_from,
  };
}

async function start() {
  // start.sh opens this descriptor while still root. The server stays uid 1000
  // and never needs permission to open Supervisor's private options file itself.
  const options = JSON.parse(fs.readFileSync(0, 'utf8'));
  const env = settings(options);
  const smtp = smtpSettings(options);
  ensureCredentialKey(path.dirname(env.DB_PATH));
  Object.assign(process.env, env);
  delete process.env.FLYBUDGET_API_TOKEN;
  if (options.multi_user === true) {
    // Separate budgets per person (docs/MULTI-USER-PLAN.md). The budget already here stays in
    // place and becomes the first person's; turning the option off goes back to it alone.
    const { startGateway } = require('/app/gateway.js');
    await startGateway({ port: 3001, serverScript: '/app/server.js', smtp });
    return;
  }
  if (smtp) console.log('The smtp_ options are used only with multi_user; email is off.');
  const { startServer } = require('/app/server.js');
  await startServer(3001);
}

module.exports = { ensureCredentialKey, settings, smtpSettings };
if (require.main === module)
  start().catch((err) => {
    // These are local setup errors, never bank responses or request headers.
    console.error('Allotment app could not start:', err.message);
    process.exitCode = 1;
  });

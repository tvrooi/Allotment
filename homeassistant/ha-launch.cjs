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
    typeof options.trust_proxy !== 'boolean'
  ) {
    throw new Error(
      'Invalid Home Assistant app configuration. Check allowed_hosts and trust_proxy.',
    );
  }
  return {
    NODE_ENV: 'production',
    ELECTRON_PROD: 'true',
    FLYBUDGET_SERVER_MODE: 'true',
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

async function start() {
  // start.sh opens this descriptor while still root. The server stays uid 1000
  // and never needs permission to open Supervisor's private options file itself.
  const options = JSON.parse(fs.readFileSync(0, 'utf8'));
  const env = settings(options);
  ensureCredentialKey(path.dirname(env.DB_PATH));
  Object.assign(process.env, env);
  delete process.env.FLYBUDGET_API_TOKEN;
  const { startServer } = require('/app/server.js');
  await startServer(3001);
}

module.exports = { ensureCredentialKey, settings };
if (require.main === module)
  start().catch((err) => {
    // These are local setup errors, never bank responses or request headers.
    console.error('FlyBudget app could not start:', err.message);
    process.exitCode = 1;
  });

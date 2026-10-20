// Only run on disposable GitHub-hosted runners, never on a user's budget profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('CI runners only');
const config =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.platform === 'win32'
      ? process.env.APPDATA
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const profile = path.join(config, 'FlyBudget');
if (fs.existsSync(profile)) throw new Error('Refusing to overwrite an existing profile');
fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(profile, 'connection.json'), JSON.stringify({ mode: 'local' }), {
  flag: 'wx',
  mode: 0o600,
});

// Runs a throwaway instance of the built HA image. No real Up token or budget is used.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

const suffix = randomBytes(5).toString('hex');
const name = `flybudget-ha-test-${suffix}`;
const volume = `${name}-data`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-ha-smoke-'));
const image = process.argv[2] || 'flybudget-up-ha:preview';
const base = 'http://127.0.0.1:33011';
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const logs = () => {
  const result = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
  return (result.stdout || '') + (result.stderr || '');
};
const password = randomBytes(24).toString('base64url');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) return;
    } catch {}
    await pause(200);
  }
  throw new Error('The container did not become healthy.\n' + logs());
}
async function post(endpoint, body, cookie) {
  return fetch(base + '/api' + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
const keyHash = () =>
  docker(
    'exec',
    name,
    'node',
    '-e',
    "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/data/flybudget/credentials.key')).digest('hex'))",
  );

async function run() {
  try {
    const metadata = JSON.parse(docker('image', 'inspect', image))[0];
    const labels = metadata.Config.Labels;
    const expectedArch = { arm64: 'aarch64', amd64: 'amd64' }[metadata.Architecture];
    assert.ok(expectedArch, 'Only the declared HA architectures are supported.');
    assert.equal(
      labels['io.hass.arch'],
      expectedArch,
      'Prebuilt images need HA architecture labels.',
    );
    assert.equal(labels['io.hass.type'], 'app');
    assert.equal(labels['io.hass.version'], require('../package.json').version);
    docker('volume', 'create', volume);
    // Supervisor-managed paths can be root-only. Keep these permissions inside
    // the Linux volume; a macOS bind mount does not reproduce them reliably.
    docker(
      'run',
      '--rm',
      '--user',
      '0:0',
      '--entrypoint',
      'node',
      '--mount',
      `type=volume,source=${volume},target=/data`,
      image,
      '-e',
      `
      const fs=require('fs');
      fs.chownSync('/data',0,0);
      fs.chmodSync('/data',0o700);
      fs.writeFileSync('/data/options.json',JSON.stringify({allowed_hosts:'budget.example.com',trust_proxy:false}),{mode:0o600});
      fs.chownSync('/data/options.json',0,0);
      fs.chmodSync('/data/options.json',0o600);
    `,
    );
    docker(
      'run',
      '-d',
      '--name',
      name,
      '--read-only',
      '--tmpfs',
      '/tmp',
      '--mount',
      `type=volume,source=${volume},target=/data`,
      '-p',
      '127.0.0.1:33011:3001',
      image,
    );
    await ready();
    // Match Supervisor: it probes the app's container IP, not localhost. With a
    // restricted allowed_hosts list the old HTTP watchdog gets 403 and can
    // restart a healthy server, invalidating its in-memory setup code.
    const appIp = docker(
      'inspect',
      '--format',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
      name,
    );
    const watchdog = fs
      .readFileSync(path.join(__dirname, 'config.yaml'), 'utf8')
      .match(/^watchdog:\s*['"](.+)['"]$/m)[1]
      .replace('[HOST]', appIp)
      .replace('[PORT:3001]', '3001');
    const target = new URL(watchdog);
    assert.equal(target.protocol, 'tcp:');
    const probe = JSON.parse(
      docker(
        'run',
        '--rm',
        '--entrypoint',
        'node',
        image,
        '-e',
        `
      const net=require('net');
      (async()=>{
        const http=await fetch('http://${appIp}:3001/api/health');
        await new Promise((resolve,reject)=>{
          const socket=net.createConnection({host:${JSON.stringify(target.hostname)},port:${Number(target.port)}},()=>{socket.end();resolve();});
          socket.setTimeout(5000,()=>socket.destroy(new Error('TCP watchdog timeout')));
          socket.on('error',reject);
        });
        console.log(JSON.stringify({httpStatus:http.status,tcpHealthy:true}));
      })().catch(error=>{console.error(error.message);process.exitCode=1;});
    `,
      ),
    );
    assert.deepEqual(
      probe,
      { httpStatus: 403, tcpHealthy: true },
      'Supervisor must use the TCP check; API host restrictions remain enforced.',
    );
    assert.equal((await fetch(base + '/api/accounts')).status, 401);
    const setupCode = docker('logs', name).match(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/)?.[0];
    assert.ok(setupCode, 'A one-time setup code must be logged.');
    const setup = await post('/auth/setup', { password, setupCode });
    assert.equal(setup.status, 204);
    const cookie = setup.headers
      .getSetCookie()
      .find((s) => s.startsWith('flybudget_session='))
      .split(';')[0];
    assert.equal((await fetch(base + '/api/up/connection', { headers: { cookie } })).status, 200);
    const account = await post(
      '/accounts',
      { name: 'HA test account', type: 'checking', startingBalance: 12345 },
      cookie,
    );
    assert.equal(account.status, 201);
    const initialKey = keyHash();
    docker('restart', name);
    await ready();
    assert.equal(keyHash(), initialKey, 'The credential key must survive a restart.');
    const login = await post('/auth/login', { password });
    assert.equal(login.status, 204);
    const session = login.headers
      .getSetCookie()
      .find((s) => s.startsWith('flybudget_session='))
      .split(';')[0];
    const accounts = await (
      await fetch(base + '/api/accounts', { headers: { cookie: session } })
    ).json();
    assert.equal(accounts[0].name, 'HA test account');
    assert.equal(accounts[0].balance, 12345);
    const unprivileged = docker(
      'exec',
      name,
      'node',
      '-e',
      `
      const fs=require('fs');
      const matches=fs.readdirSync('/proc').filter(p=>/^\\d+$/.test(p)).some(p=>{
        try { const args=fs.readFileSync('/proc/'+p+'/cmdline','utf8').split('\\0');
          return args[1]==='/app/ha-launch.cjs' && /^Uid:\\s+1000\\s/m.test(fs.readFileSync('/proc/'+p+'/status','utf8'));
        } catch { return false; }
      }); console.log(matches);
    `,
    );
    assert.equal(unprivileged, 'true');
    const permissions = JSON.parse(
      docker(
        'exec',
        name,
        'node',
        '-e',
        `
      const fs=require('fs');const s=fs.statSync('/data/options.json');
      console.log(JSON.stringify({uid:s.uid,gid:s.gid,mode:s.mode&0o777}));
    `,
      ),
    );
    assert.deepEqual(
      permissions,
      { uid: 0, gid: 0, mode: 0o600 },
      'The Supervisor options file must remain root-owned and private.',
    );
    const protectedOptions = docker(
      'exec',
      '--user',
      '1000:1000',
      name,
      'node',
      '-e',
      `
      try { require('fs').readFileSync('/data/options.json'); process.exitCode=1; }
      catch(error) { console.log(error.code); }
    `,
    );
    assert.equal(
      protectedOptions,
      'EACCES',
      'The web server should not gain direct access to the Supervisor file.',
    );
    // Multi-user mode (docs/MULTI-USER-PLAN.md): the budget already here becomes the first
    // person's, a new person's is empty, and turning it off goes back to the old password.
    const writeOptions = (options) =>
      docker(
        'exec',
        '--user',
        '0:0',
        name,
        'node',
        '-e',
        `require('fs').writeFileSync('/data/options.json',${JSON.stringify(JSON.stringify(options))},{mode:0o600})`,
      );
    writeOptions({ allowed_hosts: 'budget.example.com', trust_proxy: false, multi_user: true });
    docker('restart', name);
    await ready();
    const multiStatus = await (await fetch(base + '/api/auth/status')).json();
    assert.equal(multiStatus.multiUser, true);
    assert.equal(multiStatus.needsSetup, true);
    const gatewayCode = [
      ...docker('logs', '--since', '2m', name).matchAll(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/g),
    ].at(-1)?.[0];
    assert.ok(gatewayCode, 'Multi-user setup needs a logged setup code.');
    const owner = await post('/auth/setup', { name: 'Owner', password, setupCode: gatewayCode });
    assert.equal(owner.status, 204);
    const ownerCookie = owner.headers
      .getSetCookie()
      .find((s) => s.startsWith('flybudget_session='))
      .split(';')[0];
    const kept = await (
      await fetch(base + '/api/accounts', { headers: { cookie: ownerCookie } })
    ).json();
    assert.equal(
      kept[0].name,
      'HA test account',
      'The existing budget must become the first person’s.',
    );
    const added = await (await post('/people', { name: 'Partner' }, ownerCookie)).json();
    const partnerPassword = randomBytes(18).toString('base64url');
    const joined = await post('/auth/accept-invite', {
      name: 'Partner',
      code: added.inviteCode,
      password: partnerPassword,
    });
    assert.equal(joined.status, 204);
    const partnerCookie = joined.headers
      .getSetCookie()
      .find((s) => s.startsWith('flybudget_session='))
      .split(';')[0];
    assert.deepEqual(
      await (await fetch(base + '/api/accounts', { headers: { cookie: partnerCookie } })).json(),
      [],
      'A new person’s budget must be their own.',
    );
    assert.equal(keyHash(), initialKey, 'Multi-user mode must keep the existing key.');
    writeOptions({ allowed_hosts: 'budget.example.com', trust_proxy: false, multi_user: false });
    docker('restart', name);
    await ready();
    const back = await post('/auth/login', { password });
    assert.equal(back.status, 204, 'Turning multi-user off goes back to the old password.');
    console.log(
      'PASS: root-only Supervisor options; strict-host TCP watchdog; login/setup and native Up endpoint; persistent budget/password/key; uid 1000 server; Supervisor file stays private; multi-user keeps the existing budget and isolates a new one, and turns off cleanly.',
    );
  } finally {
    try {
      docker('rm', '-f', name);
    } catch {}
    try {
      docker('volume', 'rm', volume);
    } catch {}
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

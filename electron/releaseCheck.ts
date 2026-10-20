export interface ReleaseOffer {
  version: string;
  url: string;
}
function parts(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-up\.(\d+))?$/.exec(version);
  if (!match || version.length > 80) return null;
  const result = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? Number.MAX_SAFE_INTEGER : Number(match[4]),
  ];
  return result.every(Number.isSafeInteger) ? result : null;
}
export function newerForkVersion(candidate: string, current: string) {
  const a = parts(candidate),
    b = parts(current);
  if (!a || !b) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
export function installerName(platform: string, arch: string) {
  if (!['arm64', 'x64'].includes(arch)) return null;
  if (platform === 'darwin') return `FlyBudget-macOS-${arch}.dmg`;
  if (platform === 'win32' && arch === 'x64') return 'FlyBudget-Windows-Setup.exe';
  if (platform === 'linux') return `FlyBudget-Linux-${arch === 'x64' ? 'x86_64' : arch}.AppImage`;
  return null;
}
/** Only this fork's named release assets can be opened by the native download action. */
export function isForkInstaller(url: string, tag: string, name: string) {
  try {
    const u = new URL(url);
    return (
      !!parts(tag) &&
      u.origin === 'https://github.com' &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      u.pathname === `/tvrooi/FlyBudget/releases/download/${tag}/${name}`
    );
  } catch {
    return false;
  }
}
export async function checkInstallerRelease(
  current: string,
  platform: string,
  arch: string,
  request: typeof fetch = fetch,
): Promise<ReleaseOffer | null> {
  const name = installerName(platform, arch);
  if (!name) return null;
  const response = await request(
    'https://api.github.com/repos/tvrooi/FlyBudget/releases?per_page=20',
    {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FlyBudget-desktop-updates' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok || !response.body) throw new Error('Could not check desktop releases.');
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Release response too large.');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(body)) throw new Error('Invalid release response.');
  let best: ReleaseOffer | null = null;
  for (const release of body) {
    if (
      !release ||
      release.draft !== false ||
      typeof release.tag_name !== 'string' ||
      !Array.isArray(release.assets) ||
      !newerForkVersion(release.tag_name, best?.version ?? current)
    )
      continue;
    const asset = release.assets.find(
      (a: unknown) => a && typeof a === 'object' && 'name' in a && a.name === name,
    );
    if (
      !asset ||
      typeof asset.browser_download_url !== 'string' ||
      !isForkInstaller(asset.browser_download_url, release.tag_name, name)
    )
      continue;
    best = { version: release.tag_name.replace(/^v/, ''), url: asset.browser_download_url };
  }
  return best;
}

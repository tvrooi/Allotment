import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

export type BudgetLocation =
  { mode: 'local' } | { mode: 'server'; url: string; allowHttp: boolean };

/** Keep the desktop profile free of passwords and bank credentials in server mode. */
export function parseLocation(value: unknown): BudgetLocation {
  if (!value || typeof value !== 'object') throw new Error('Choose a budget location.');
  const input = value as Record<string, unknown>;
  if (input.mode === 'local') return { mode: 'local' };
  if (input.mode !== 'server' || typeof input.url !== 'string') {
    throw new Error('Enter the Allotment server address.');
  }
  const text = input.url.trim();
  if (!text || text.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(text)) {
    throw new Error('Enter a complete http:// or https:// server address.');
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('Enter a complete http:// or https:// server address.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('The server address must use http:// or https://.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use the server address only, without a password, path, query or fragment.');
  }
  if (url.protocol === 'http:' && input.allowHttp !== true) {
    throw new Error('For HTTP, confirm that you trust this home network or VPN.');
  }
  return { mode: 'server', url: url.origin + '/', allowHttp: url.protocol === 'http:' };
}

export function loadLocation(userData: string): BudgetLocation | null {
  try {
    return parseLocation(
      JSON.parse(fs.readFileSync(path.join(userData, 'connection.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(
      'The saved server address could not be read. Choose the budget location again.',
    );
  }
}

export function saveLocation(userData: string, value: unknown): BudgetLocation {
  const location = parseLocation(value);
  fs.mkdirSync(userData, { recursive: true });
  const target = path.join(userData, 'connection.json');
  const temporary = target + '.' + randomBytes(8).toString('hex');
  try {
    fs.writeFileSync(temporary, JSON.stringify(location) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return location;
}

/** A different server never inherits another budget's cookies or offline copy. */
export function serverPartition(url: string): string {
  return 'persist:server-' + createHash('sha256').update(new URL(url).origin).digest('hex');
}

export function sameOrigin(candidate: string, appUrl: string): boolean {
  try {
    return new URL(candidate).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

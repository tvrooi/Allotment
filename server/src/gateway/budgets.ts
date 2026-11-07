import { spawn } from 'child_process';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { Person } from './store.js';

// Each person's budget runs as its own Allotment server process (docs/MULTI-USER-PLAN.md), on
// loopback only, with its own database and encryption key. Isolation comes from separate
// files and processes, not from query filters. The gateway starts them, restarts one that
// stops, and forwards requests to it with a secret only the gateway and its budgets know.

/** A started budget process */
export interface Running {
  stop(): void;
  /** Settles when the process ends, for whatever reason */
  exited: Promise<void>;
}

/**
 * Starts one person's budget listening on 127.0.0.1:port. `notifyToken` lets it send its
 * person a message through the gateway's loopback listener (notifyListener.ts), and no one else.
 */
export type Launch = (person: Person, port: number, secret: string, notifyToken: string) => Running;

export class Budgets {
  /** Sent with every request forwarded for a signed-in person; new on each gateway start */
  readonly secret = randomBytes(32).toString('base64url');
  private ports = new Map<string, number>();
  private running = new Map<string, Running>();
  private stopping = new Set<string>();
  private ready = new Map<string, Promise<void>>();
  /** Person id → SHA-256 of their running budget's notify token, new on each launch */
  private notifyTokens = new Map<string, Buffer>();
  private nextPort: number;

  constructor(
    private launch: Launch,
    basePort: number,
    private healthTimeoutMs = 60_000,
  ) {
    this.nextPort = basePort;
  }

  /** The port a running person's budget listens on */
  port(personId: string) {
    return this.running.has(personId) ? this.ports.get(personId) : undefined;
  }

  isRunning(personId: string) {
    return this.running.has(personId);
  }

  /** Starts a person's budget (if not running) and waits until it answers */
  start(person: Person): Promise<void> {
    const existing = this.ready.get(person.id);
    if (existing && this.running.has(person.id)) return existing;
    let port = this.ports.get(person.id);
    if (port === undefined) {
      port = this.nextPort++;
      this.ports.set(person.id, port);
    }
    this.stopping.delete(person.id);
    const notifyToken = randomBytes(32).toString('base64url');
    this.notifyTokens.set(person.id, tokenDigest(notifyToken));
    const proc = this.launch(person, port, this.secret, notifyToken);
    this.running.set(person.id, proc);
    void proc.exited.then(() => {
      if (this.running.get(person.id) !== proc) return;
      this.running.delete(person.id);
      this.ready.delete(person.id);
      this.notifyTokens.delete(person.id);
      // Stopped unexpectedly: start it again shortly
      if (!this.stopping.has(person.id)) {
        console.error(`A budget stopped unexpectedly (${person.id}); restarting it in 5 seconds`);
        setTimeout(() => {
          if (!this.stopping.has(person.id)) void this.start(person).catch(() => {});
        }, 5_000).unref();
      }
    });
    const ready = waitForHealth(port, this.healthTimeoutMs);
    this.ready.set(person.id, ready);
    return ready;
  }

  stop(personId: string) {
    this.stopping.add(personId);
    this.running.get(personId)?.stop();
    this.running.delete(personId);
    this.ready.delete(personId);
    this.notifyTokens.delete(personId);
  }

  /** Whose running budget holds this notify token, compared in constant time */
  personForNotifyToken(token: string): string | undefined {
    const given = tokenDigest(token);
    let found: string | undefined;
    for (const [personId, digest] of this.notifyTokens)
      if (timingSafeEqual(given, digest)) found = personId;
    return found;
  }

  async stopAll() {
    const all = [...this.running.entries()];
    for (const [id] of all) this.stopping.add(id);
    for (const [, proc] of all) proc.stop();
    await Promise.all(all.map(([, proc]) => proc.exited));
    this.running.clear();
    this.ready.clear();
    this.notifyTokens.clear();
  }
}

const tokenDigest = (token: string) => createHash('sha256').update(token).digest();

/** Waits until a budget's /api/health answers on loopback */
export async function waitForHealth(port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/health', timeout: 2_000 },
        (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    if (Date.now() > deadline) throw new Error(`A budget did not start on port ${port}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Starts budgets as child processes running the Allotment server (`script`, e.g. /app/server.js)
 * in server mode on 127.0.0.1, with the person's database and key, and the gateway's notify
 * listener (`notifyUrl`) for their reminders. Their log lines are prefixed
 * with the person's id, never their name.
 */
export function processLauncher(script: string, args: string[] = [], notifyUrl?: string): Launch {
  return (person, port, secret, notifyToken) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FLYBUDGET_SERVER_MODE: 'true',
      FLYBUDGET_HOST: '127.0.0.1',
      EXPRESS_PORT: String(port),
      PORT: String(port),
      DB_PATH: person.dbPath,
      FLYBUDGET_DATA_KEY_FILE: person.keyPath,
      FLYBUDGET_GATEWAY_SECRET: secret,
      FLYBUDGET_PERSON_ID: person.id,
      // Only the gateway connects, from loopback; it passes the browser's address and scheme
      FLYBUDGET_TRUST_PROXY: 'loopback',
      // What Settings → Server reports: the gateway's own setup, which the browser reaches
      FLYBUDGET_OUTER_TRUST_PROXY: process.env.FLYBUDGET_TRUST_PROXY ?? '',
      // Its reminders go to its person through the gateway (D2b), never named by the budget
      ...(notifyUrl
        ? { FLYBUDGET_NOTIFY_URL: notifyUrl, FLYBUDGET_NOTIFY_TOKEN: notifyToken }
        : {}),
    };
    // The gateway serves the app's pages; a budget only answers the API
    delete env.CLIENT_DIST;
    delete env.ELECTRON_PROD;
    delete env.FLYBUDGET_DATA_KEY;
    delete env.FLYBUDGET_API_TOKEN;
    // Only the gateway sends Home Assistant notifications
    delete env.SUPERVISOR_TOKEN;
    const child = spawn(process.execPath, [...args, script], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const prefix = `[budget ${person.id}] `;
    const relay = (stream: NodeJS.ReadableStream | null, out: NodeJS.WriteStream) => {
      let rest = '';
      stream?.on('data', (chunk: Buffer) => {
        const lines = (rest + chunk.toString()).split('\n');
        rest = lines.pop() ?? '';
        for (const line of lines) out.write(prefix + line + '\n');
      });
    };
    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    return { stop: () => void child.kill('SIGTERM'), exited };
  };
}

/**
 * Creates the 32-byte key that encrypts a budget's bank credentials, if it doesn't exist yet.
 * An existing key is never replaced (it would make stored bank tokens unreadable).
 */
export function ensureKey(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(file, randomBytes(32).toString('base64') + '\n', { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
  const stored = fs.readFileSync(file, 'utf8').trim();
  const bytes = Buffer.from(stored, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== stored)
    throw new Error(`The encryption key ${file} is invalid; it has not been replaced`);
}

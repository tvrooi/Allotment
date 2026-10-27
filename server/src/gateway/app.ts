import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { randomBytes } from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { z } from 'zod';
import { trustProxy } from '../config.js';
import {
  BANK_CALLBACK_PATH,
  errorHandler,
  hostGuard,
  hstsWhenSecure,
  originGuard,
  proxyConfigWarning,
  readCookie,
  securityHeaders,
} from '../middleware/security.js';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
} from '../auth/password.js';
import { checkSetupCode, clearSetupCode, setupCode } from '../auth/setupCode.js';
import { Budgets, ensureKey } from './budgets.js';
import { NOTIFY_SERVICE, type Notify } from './notify.js';
import {
  HANDED_CODE_TTL_MS,
  NOTIFIED_CODE_TTL_MS,
  SESSION_TTL_MS,
  type GatewayStore,
  type Person,
} from './store.js';

// The multi-user gateway (docs/MULTI-USER-PLAN.md). It signs people in, then forwards every
// other API request to that person's own budget process with a secret header. It never reads
// a budget's data, and nothing it forwards can reach another person's budget: the session
// decides the budget, and an access token names its own.

export const SESSION_COOKIE = 'flybudget_session';
/** Header carrying the secret to a budget (see routes/auth.ts, GATEWAY_HEADER) */
const GATEWAY_HEADER = 'x-flybudget-gateway';
/** How long an invitation code stays valid */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Reading-only access tokens name their budget: fbro_<person id>_<random> */
const ROUTED_TOKEN = /^Bearer\s+fbro_([0-9a-f]{12})_[A-Za-z0-9_-]{20,}$/;

export interface GatewayOptions {
  store: GatewayStore;
  budgets: Budgets;
  /** The budget that was here before multi-user mode: it becomes the first person's */
  ownerBudget: { dbPath: string; keyPath: string };
  /** Where new people's budgets are created, one folder each */
  budgetsDir: string;
  clientDist?: string;
  notify: Notify;
  canNotify: () => boolean;
  /** Where codes for the administrator are written (the app's Log) */
  log?: (message: string) => void;
}

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((n) => !/[\u0000-\u001f]/.test(n), 'Invalid name');
const newPassword = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);
const passwordRule = `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`;

export function createGateway(o: GatewayOptions) {
  const { store, budgets } = o;
  const log = o.log ?? ((m: string) => console.log(m));
  const app = express();
  if (trustProxy)
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' || trustProxy,
    );
  app.disable('x-powered-by');
  app.use(proxyConfigWarning, hostGuard, originGuard, securityHeaders, hstsWhenSecure);

  const sessionToken = (req: Request) => readCookie(req.headers.cookie, SESSION_COOKIE);
  const signedIn = (req: Request) => store.personForSession(sessionToken(req));

  function startSession(req: Request, res: Response, person: Person) {
    const token = store.createSession(person.id, req.headers['user-agent']);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  }

  /**
   * A new password revokes the person's read-only access tokens, as it does without the
   * gateway. The store marks it pending (setPassword); their budget is asked to, with the
   * secret, and only its answer clears the mark. Until then the gateway itself refuses their
   * tokens, and keeps asking: before each token request and every 30 seconds.
   */
  function revokeTokens(personId: string): Promise<boolean> {
    const port = budgets.port(personId);
    if (!port) return Promise.resolve(false);
    return new Promise((resolve) => {
      const call = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/api/access-tokens/revoke-all',
          headers: { [GATEWAY_HEADER]: budgets.secret, 'content-length': 0 },
          timeout: 10_000,
        },
        (answer) => {
          answer.resume();
          const ok = answer.statusCode === 204;
          if (ok) store.tokensRevoked(personId);
          resolve(ok);
        },
      );
      call.on('error', () => resolve(false));
      call.on('timeout', () => call.destroy());
      call.end();
    });
  }
  const retry = setInterval(() => {
    for (const id of store.pendingRevocations()) void revokeTokens(id);
  }, 30_000);
  retry.unref();

  /** Spends the hashing time even when there's no one to check, so timing reveals nothing */
  async function checkPassword(person: Person | undefined, password: string) {
    const hash = person && !person.disabled ? store.passwordHash(person.id) : null;
    if (!hash) {
      await hashPassword(password);
      return false;
    }
    return verifyPassword(password, hash);
  }

  const limited = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many attempts. Wait 15 minutes and try again.' },
    });
  const authLimit = limited(10);
  // Every request counts, so codes can't be sent to someone's phone over and over
  const forgotLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Wait 15 minutes and try again.' },
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // ─── Signing in ────────────────────────────────────────────────────────────

  const auth = Router();
  auth.use(express.json({ limit: '100kb' }));

  auth.get('/status', (req, res) => {
    const needsSetup = store.people().length === 0;
    if (needsSetup) setupCode();
    const person = signedIn(req);
    res.json({
      enabled: true,
      multiUser: true,
      needsSetup,
      authenticated: Boolean(person),
      canNotify: o.canNotify(),
      person: person && {
        id: person.id,
        name: person.name,
        isAdmin: person.isAdmin,
        notifyService: person.notifyService,
      },
    });
  });

  // First run: the person who sets up becomes the administrator, and the budget that was
  // already here becomes theirs. The setup code is printed in the Log, as without the gateway.
  auth.post('/setup', authLimit, async (req, res) => {
    const parsed = z
      .object({ name: nameSchema, password: newPassword, setupCode: z.string().max(100) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: `Enter a name. ${passwordRule}` });
    if (store.people().length) return res.status(409).json({ error: 'Already set up' });
    if (!checkSetupCode(parsed.data.setupCode))
      return res.status(403).json({ error: 'Incorrect setup code' });
    const hash = await hashPassword(parsed.data.password);
    let person: Person;
    try {
      person = store.addPerson({ name: parsed.data.name, isAdmin: true, ...o.ownerBudget });
    } catch {
      return res.status(409).json({ error: 'Already set up' });
    }
    store.setPassword(person.id, hash);
    clearSetupCode();
    await budgets.start(person);
    startSession(req, res, person);
    res.status(204).send();
  });

  auth.post('/login', authLimit, async (req, res) => {
    const parsed = z
      .object({ name: z.string().max(200), password: z.string().max(MAX_PASSWORD_LENGTH) })
      .safeParse(req.body);
    const person = parsed.success ? store.personByName(parsed.data.name) : undefined;
    if (!parsed.success || !(await checkPassword(person, parsed.data.password)))
      return res.status(401).json({ error: 'Incorrect name or password' });
    if (!budgets.isRunning(person!.id)) await budgets.start(person!);
    startSession(req, res, person!);
    res.status(204).send();
  });

  auth.post('/logout', (req, res) => {
    store.deleteSession(sessionToken(req));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).send();
  });

  auth.post('/change-password', authLimit, async (req, res) => {
    const person = signedIn(req);
    if (!person) return res.status(401).json({ error: 'Login required' });
    const parsed = z
      .object({ currentPassword: z.string().max(MAX_PASSWORD_LENGTH), newPassword })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: `New ${passwordRule.toLowerCase()}` });
    if (!(await checkPassword(person, parsed.data.currentPassword)))
      return res.status(401).json({ error: 'Current password is incorrect' });
    store.setPassword(person.id, await hashPassword(parsed.data.newPassword), sessionToken(req));
    await revokeTokens(person.id);
    res.status(204).send();
  });

  // An invited person sets their own password with the code the administrator passed on
  auth.post('/accept-invite', authLimit, async (req, res) => {
    const parsed = z
      .object({ name: z.string().max(200), code: z.string().max(100), password: newPassword })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: passwordRule });
    const person = store.personByName(parsed.data.name);
    if (
      !person ||
      person.disabled ||
      person.hasPassword ||
      !store.useCode(person.id, 'invite', parsed.data.code)
    )
      return res.status(401).json({ error: 'That name and invitation code do not match' });
    store.setPassword(person.id, await hashPassword(parsed.data.password));
    if (!budgets.isRunning(person.id)) await budgets.start(person);
    startSession(req, res, person);
    res.status(204).send();
  });

  // Forgot password: a code goes to the person's phone (Home Assistant notification). For the
  // administrator it is also written to the app's Log, which only a Home Assistant
  // administrator can read. The answer is the same whoever asks, so it reveals nobody.
  auth.post('/forgot', forgotLimit, async (req, res) => {
    const parsed = z.object({ name: z.string().max(200) }).safeParse(req.body);
    const person = parsed.success ? store.personByName(parsed.data.name) : undefined;
    if (person && !person.disabled && person.hasPassword) {
      // One code: for the administrator a longer one that also goes to the Log
      const code = person.isAdmin
        ? store.issueCode(person.id, 'reset', HANDED_CODE_TTL_MS)
        : person.notifyService && o.canNotify()
          ? store.issueCode(person.id, 'reset', NOTIFIED_CODE_TTL_MS, true)
          : null;
      if (code && person.notifyService && o.canNotify())
        // Not awaited: the answer must take as long for anyone, so it reveals nobody
        void o
          .notify(
            person.notifyService,
            'FlyBudget password reset',
            `Your FlyBudget code is ${code}. It works once, for ${person.isAdmin ? '24 hours' : '10 minutes'}. If you didn't ask for it, ignore this message.`,
          )
          .catch((e) => console.error('A password code could not be sent:', (e as Error).message));
      if (code && person.isAdmin)
        log(`\nPassword reset code for ${person.name}: ${code} (works once, for 24 hours)\n`);
    }
    res.status(202).json({
      message:
        'If that person can receive codes, one is on its way: to their phone, or for the administrator, in the app’s Log.',
    });
  });

  auth.post('/reset', authLimit, async (req, res) => {
    const parsed = z
      .object({ name: z.string().max(200), code: z.string().max(100), password: newPassword })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: passwordRule });
    const person = store.personByName(parsed.data.name);
    if (!person || person.disabled || !store.useCode(person.id, 'reset', parsed.data.code))
      return res.status(401).json({ error: 'That name and code do not match' });
    store.setPassword(person.id, await hashPassword(parsed.data.password));
    if (!budgets.isRunning(person.id)) await budgets.start(person);
    await revokeTokens(person.id);
    startSession(req, res, person);
    res.status(204).send();
  });

  // Signed-in devices (Settings → Server), the person's own only
  auth.get('/sessions', (req, res) => {
    const person = signedIn(req);
    if (!person) return res.status(401).json({ error: 'Login required' });
    res.json(store.listSessions(person.id, sessionToken(req)));
  });
  auth.post('/sessions/sign-out-others', (req, res) => {
    const person = signedIn(req);
    if (!person) return res.status(401).json({ error: 'Login required' });
    res.json({ signedOut: store.deleteOtherSessions(person.id, sessionToken(req)!) });
  });
  auth.delete('/sessions/:id', (req, res) => {
    const person = signedIn(req);
    if (!person) return res.status(401).json({ error: 'Login required' });
    if (!/^[0-9a-f]{12}$/.test(req.params.id))
      return res.status(400).json({ error: 'Invalid session id' });
    const current =
      store.listSessions(person.id, sessionToken(req)).find((s) => s.current)?.id === req.params.id;
    if (!store.deleteSessionByPublicId(person.id, req.params.id))
      return res.status(404).json({ error: 'Not found' });
    if (current) res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).send();
  });
  app.use('/api/auth', auth);

  // ─── People (Settings → Server → People) ───────────────────────────────────

  const people = Router();
  people.use(express.json({ limit: '100kb' }));
  const requirePerson: RequestHandler = (req, res, next) => {
    const person = signedIn(req);
    if (!person) return void res.status(401).json({ error: 'Login required' });
    res.locals.person = person;
    next();
  };
  const requireAdmin: RequestHandler = (_req, res, next) => {
    if (!(res.locals.person as Person).isAdmin)
      return void res.status(403).json({ error: 'Only the administrator can do this' });
    next();
  };
  people.use(requirePerson);

  // Each person chooses where their own codes go
  people.put('/me/notify', (req, res) => {
    const parsed = z
      .object({
        service: z
          .string()
          .trim()
          .transform((s) => s.replace(/^notify\./, ''))
          .pipe(z.string().regex(NOTIFY_SERVICE))
          .nullable(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Use the notify service name, e.g. notify.mobile_app_my_phone' });
    store.setNotifyService((res.locals.person as Person).id, parsed.data.service);
    res.json({ notifyService: parsed.data.service });
  });
  people.post('/me/notify/test', async (_req, res) => {
    const person = res.locals.person as Person;
    if (!person.notifyService || !o.canNotify())
      return res.status(400).json({ error: 'Choose a notify service first' });
    try {
      await o.notify(
        person.notifyService,
        'FlyBudget',
        'Password codes for FlyBudget will come here.',
      );
      res.status(204).send();
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  const describe = (p: Person) => ({
    id: p.id,
    name: p.name,
    isAdmin: p.isAdmin,
    disabled: p.disabled,
    hasPassword: p.hasPassword,
    notifyService: p.notifyService,
    running: budgets.isRunning(p.id),
  });

  people.get('/', requireAdmin, (_req, res) => res.json(store.people().map(describe)));

  // A new person gets an empty budget of their own and an invitation code to pass on
  people.post('/', requireAdmin, async (req, res) => {
    const parsed = z.object({ name: nameSchema }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Enter a name (up to 60 characters)' });
    if (store.personByName(parsed.data.name))
      return res.status(409).json({ error: 'Someone already has that name' });
    const folder = path.join(o.budgetsDir, randomBytes(6).toString('hex'));
    const dbPath = path.join(folder, 'budget.db');
    const keyPath = path.join(folder, 'credentials.key');
    ensureKey(keyPath);
    const person = store.addPerson({ name: parsed.data.name, isAdmin: false, dbPath, keyPath });
    const inviteCode = store.issueCode(person.id, 'invite', INVITE_TTL_MS);
    try {
      await budgets.start(person);
    } catch (e) {
      console.error('A new budget did not start:', (e as Error).message);
    }
    res.status(201).json({ person: describe(store.person(person.id)!), inviteCode });
  });

  const target = (req: Request, res: Response): Person | undefined => {
    const person = store.person(String(req.params.id));
    if (!person) return void res.status(404).json({ error: 'Not found' });
    if (person.isAdmin)
      return void res.status(400).json({ error: 'The administrator uses Forgot password instead' });
    return person;
  };

  // A new invitation, for someone who hasn't set their password yet
  people.post('/:id/invite', requireAdmin, (req, res) => {
    const person = target(req, res);
    if (!person) return;
    if (person.hasPassword)
      return res.status(409).json({ error: 'They have a password; use Reset password' });
    res.json({ inviteCode: store.issueCode(person.id, 'invite', INVITE_TTL_MS) });
  });

  // The administrator can let someone back in, but never in their place: the code is
  // written to the Log, and it only lets that person choose a new password
  people.post('/:id/reset-code', requireAdmin, (req, res) => {
    const person = target(req, res);
    if (!person) return;
    const code = store.issueCode(person.id, 'reset', HANDED_CODE_TTL_MS);
    log(`\nPassword reset code for ${person.name}: ${code} (works once, for 24 hours)\n`);
    res.status(204).send();
  });

  people.post('/:id/disable', requireAdmin, (req, res) => {
    const person = target(req, res);
    if (!person) return;
    store.setDisabled(person.id, true);
    budgets.stop(person.id);
    res.json(describe(store.person(person.id)!));
  });

  people.post('/:id/enable', requireAdmin, async (req, res) => {
    const person = target(req, res);
    if (!person) return;
    store.setDisabled(person.id, false);
    await budgets.start(store.person(person.id)!);
    res.json(describe(store.person(person.id)!));
  });
  app.use('/api/people', people);

  // ─── Everything else: the signed-in person's own budget ────────────────────

  // The bank's redirect after an Enable Banking login carries no session (it comes from the
  // bank's site), so it can only go to the administrator's budget
  app.get(BANK_CALLBACK_PATH, (req, res) => {
    const admin = store.people().find((p) => p.isAdmin && !p.disabled);
    const port = admin && budgets.port(admin.id);
    if (!port) return res.status(503).json({ error: 'Not available' });
    forward(req, res, port, false);
  });

  app.use('/api', (req, res) => {
    // An access token (Settings → Server → Read-only access) goes to the budget that issued it,
    // which checks it. The gateway's secret is never added to these requests.
    const routed = ROUTED_TOKEN.exec(req.headers.authorization ?? '');
    if (routed) {
      const owner = store.person(routed[1]);
      const port = owner && !owner.disabled ? budgets.port(owner.id) : undefined;
      const refused = () => void res.status(401).json({ error: 'Invalid or expired access token' });
      if (!owner || !port) return refused();
      // A password changed since: the tokens must be revoked before any is let through
      if (store.revocationPending(owner.id)) {
        return void revokeTokens(owner.id).then((done) =>
          done ? forward(req, res, port, false) : refused(),
        );
      }
      return forward(req, res, port, false);
    }
    const person = signedIn(req);
    if (!person) return void res.status(401).json({ error: 'Login required' });
    const port = budgets.port(person.id);
    if (!port) {
      void budgets.start(person).catch(() => {});
      return void res
        .status(503)
        .json({ error: 'Your budget is starting. Try again in a moment.' });
    }
    // Finish a pending revocation first, so a token made now isn't caught by it
    if (store.revocationPending(person.id))
      return void revokeTokens(person.id).then(() => forward(req, res, port, true));
    forward(req, res, port, true);
  });

  /** Passes the request to a budget on loopback, with the secret only for a signed-in person */
  function forward(req: Request, res: Response, port: number, withSecret: boolean) {
    const headers: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined || HOP_BY_HOP.has(key)) continue;
      // The budget needs no cookies: the gateway's session must never reach it
      if (key === 'cookie') continue;
      if (key.startsWith('x-forwarded-') || key.startsWith('x-flybudget-')) continue;
      headers[key] = value;
    }
    // For Settings → Server: whether the browser's request came through a reverse proxy
    if (req.headers['x-forwarded-for'] !== undefined || req.headers.forwarded !== undefined)
      headers['x-flybudget-outer-forwarded'] = '1';
    headers['x-forwarded-for'] = req.ip ?? '';
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-host'] = req.host;
    if (withSecret) headers[GATEWAY_HEADER] = budgets.secret;
    const upstream = http.request(
      { host: '127.0.0.1', port, method: req.method, path: req.originalUrl, headers },
      (answer) => {
        const out: http.OutgoingHttpHeaders = {};
        for (const [key, value] of Object.entries(answer.headers))
          if (value !== undefined && !HOP_BY_HOP.has(key)) out[key] = value;
        res.writeHead(answer.statusCode ?? 502, out);
        answer.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'The budget did not answer' });
      else res.destroy();
    });
    req.pipe(upstream);
  }

  // ─── The app's pages ───────────────────────────────────────────────────────

  if (o.clientDist && fs.existsSync(o.clientDist)) {
    const dist = path.resolve(o.clientDist);
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

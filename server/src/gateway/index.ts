import fs from 'fs';
import path from 'path';
import { listenHost, serverMode } from '../config.js';
import { setupCode } from '../auth/setupCode.js';
import { createGateway } from './app.js';
import { Budgets, ensureKey, processLauncher } from './budgets.js';
import { canNotify, homeAssistantNotify } from './notify.js';
import { GatewayStore } from './store.js';

// Multi-user mode's entry point (docs/MULTI-USER-PLAN.md), bundled as gateway.js. It listens
// where the single-user server would, and runs one Allotment server per person on loopback.
//
// Environment:
// - DB_PATH, FLYBUDGET_DATA_KEY_FILE: the budget that was here before; it becomes the first
//   person's (the administrator's), in place. Nothing is moved or rewritten.
// - FLYBUDGET_GATEWAY_DB: the gateway's own database (default: people.db next to DB_PATH)
// - FLYBUDGET_BUDGETS_DIR: where new people's budgets go (default: budgets/ next to DB_PATH)
// - FLYBUDGET_SERVER_SCRIPT: the Allotment server each budget runs (default: server.js here)
// - FLYBUDGET_BUDGET_PORT: the first loopback port for budgets (default 4101)
// - PORT, FLYBUDGET_HOST, FLYBUDGET_ALLOWED_HOSTS, FLYBUDGET_TRUST_PROXY, CLIENT_DIST: as for
//   the single-user server

export interface GatewayStart {
  port: number;
  serverScript: string;
  serverArgs?: string[];
}

export async function startGateway({ port, serverScript, serverArgs = [] }: GatewayStart) {
  if (!serverMode) throw new Error('Multi-user mode needs FLYBUDGET_SERVER_MODE=true');
  const dbPath = process.env.DB_PATH;
  const keyPath = process.env.FLYBUDGET_DATA_KEY_FILE;
  if (!dbPath || !keyPath)
    throw new Error('Multi-user mode needs DB_PATH and FLYBUDGET_DATA_KEY_FILE');
  const dataDir = path.dirname(dbPath);
  const store = new GatewayStore(
    process.env.FLYBUDGET_GATEWAY_DB ?? path.join(dataDir, 'people.db'),
  );
  const budgetsDir = process.env.FLYBUDGET_BUDGETS_DIR ?? path.join(dataDir, 'budgets');
  fs.mkdirSync(budgetsDir, { recursive: true, mode: 0o700 });
  ensureKey(keyPath);

  const budgets = new Budgets(
    processLauncher(serverScript, serverArgs),
    Number(process.env.FLYBUDGET_BUDGET_PORT ?? 4101),
  );
  const app = createGateway({
    store,
    budgets,
    ownerBudget: { dbPath, keyPath },
    budgetsDir,
    clientDist: process.env.CLIENT_DIST,
    notify: homeAssistantNotify(),
    canNotify,
  });

  // Everyone who may sign in has their budget running, so Up polling and the like keep going
  const active = store.people().filter((p) => !p.disabled);
  await Promise.all(
    active.map((p) =>
      budgets.start(p).catch((e) => console.error(`A budget did not start (${p.id}):`, e.message)),
    ),
  );
  store.deleteExpiredSessions();
  setInterval(() => store.deleteExpiredSessions(), 60 * 60 * 1000).unref();

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const s = app.listen(port, listenHost, (err?: Error) => (err ? reject(err) : resolve(s)));
  });
  console.log(`Allotment multi-user gateway on port ${port}: ${active.length} budget(s) running.`);
  if (store.people().length === 0) setupCode();

  const shutdown = async () => {
    server.close();
    await budgets.stopAll();
    store.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  return { server, budgets, store };
}

// Run directly (`node gateway.js`) unless imported by a launcher. In development and tests the
// budgets run from source: FLYBUDGET_SERVER_SCRIPT=src/index.ts FLYBUDGET_SERVER_NODE_ARGS="--import tsx"
if (process.env.FLYBUDGET_GATEWAY_AUTOSTART === 'true') {
  startGateway({
    port: Number(process.env.PORT ?? 3001),
    serverScript:
      process.env.FLYBUDGET_SERVER_SCRIPT ?? path.join(path.dirname(process.argv[1]), 'server.js'),
    serverArgs: (process.env.FLYBUDGET_SERVER_NODE_ARGS ?? '').split(' ').filter(Boolean),
  }).catch((err) => {
    console.error('Allotment gateway could not start:', err.message);
    process.exit(1);
  });
}

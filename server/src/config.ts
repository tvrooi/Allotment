// Runtime configuration from environment variables.
//
// FlyBudget runs in three ways:
// - desktop app (Electron): local only, protected by a per-launch secret
// - `npm run dev`: local only, for development
// - server mode (Docker / self-hosted): reachable from other devices, so every
//   request needs a logged-in session (see routes/auth.ts)

/**
 * Multi-user mode (docs/MULTI-USER-PLAN.md): this budget runs behind the gateway, which signs
 * people in and adds this secret to every request it forwards for a signed-in person. The
 * budget then listens on loopback only and accepts the secret instead of its own password.
 */
export const gatewaySecret = process.env.FLYBUDGET_GATEWAY_SECRET || undefined;
/** The person this budget belongs to (behind the gateway): it routes access tokens by it */
export const gatewayPersonId = /^[0-9a-f]{12}$/.test(process.env.FLYBUDGET_PERSON_ID ?? '')
  ? process.env.FLYBUDGET_PERSON_ID
  : undefined;

/** Self-hosted server: require a password login for everything. */
export const serverMode = process.env.FLYBUDGET_SERVER_MODE === 'true';

/** Address to listen on. Only server mode should listen beyond this machine. */
export const listenHost = process.env.FLYBUDGET_HOST ?? '127.0.0.1';

/**
 * Hostnames (optionally with :port) the server answers to in server mode, e.g.
 * "budget.example.com,192.168.1.20:3001". Empty = any host (login still required).
 */
export const allowedHosts = (process.env.FLYBUDGET_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/**
 * Express "trust proxy" setting for running behind a reverse proxy (so HTTPS and
 * client IPs are detected correctly), e.g. "loopback" or "1". Unset = no proxy.
 */
export const trustProxy = process.env.FLYBUDGET_TRUST_PROXY;

/**
 * How FlyBudget is running: the desktop app (Electron passes a per-launch API token),
 * a self-hosted server, or `npm run dev`. Read on load, before Electron clears the token
 * from the environment.
 */
export type AppMode = 'desktop' | 'server' | 'dev';
export const appMode: AppMode = serverMode
  ? 'server'
  : process.env.FLYBUDGET_API_TOKEN
    ? 'desktop'
    : 'dev';

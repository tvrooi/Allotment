import { codeMatches, formatSetupCode, randomCode } from './setupCode.js';

// One-time password reset code for single-user server mode. Like the setup code it is made on
// the server, written only to the server log (and, on Home Assistant, to a Home Assistant
// notification), has 80 random bits, and lives in memory: a restart discards it. It also
// expires after 24 hours (the multi-user administrator's reset codes do too) and works once.
// Asking again while a code is still valid hands out the same code, so a stranger who can
// reach the login page cannot keep replacing the one the owner is about to type.

export const RESET_CODE_TTL_MS = 24 * 60 * 60 * 1000;

let current: { code: string; expiresAt: number } | undefined;

/** The live reset code, making one if there is none (or it expired). */
export function issueResetCode(now = Date.now()): string {
  if (!current || current.expiresAt <= now)
    current = { code: randomCode(), expiresAt: now + RESET_CODE_TTL_MS };
  return formatSetupCode(current.code);
}

/** True once, for the right unexpired code; the code is spent either way it matches. */
export function consumeResetCode(input: unknown, now = Date.now()): boolean {
  if (!current) return false;
  if (current.expiresAt <= now) {
    current = undefined;
    return false;
  }
  if (!codeMatches(current.code, input)) return false;
  current = undefined;
  return true;
}

export function clearResetCode() {
  current = undefined;
}

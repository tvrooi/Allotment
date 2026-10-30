import { createHash, randomInt, timingSafeEqual } from 'crypto';

// One-time setup code for server mode (like Jenkins' initial admin password).
// Until a password is set, whoever reaches the server first could set it, including
// a malicious website using DNS rebinding. Setup therefore also needs this code,
// which is only printed in the server log, so only someone with access to the
// server (`docker logs flybudget`) can complete it. It lives in memory: a restart
// prints a new one, and it's discarded once the password is set.

// 32 characters without look-alikes (0/O, 1/I): 16 characters = 80 random bits
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 16;

let code: string | undefined;

const normalize = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
const digest = (value: string) => createHash('sha256').update(value).digest();

/** A fresh random code of the setup code's strength (80 random bits) */
export const randomCode = () =>
  Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Compares in constant time; dashes, spaces and case don't matter. */
export function codeMatches(expected: string, input: unknown): boolean {
  if (typeof input !== 'string' || input.length > 100) return false;
  return timingSafeEqual(digest(normalize(input)), digest(expected));
}

/** The current setup code, creating it (and printing it to the log) if needed. */
export function setupCode(): string {
  if (!code) {
    code = randomCode();
    console.log(
      '\nAllotment needs a password. Open it in your browser and enter this setup code:\n\n' +
        `    ${formatSetupCode(code)}\n`,
    );
  }
  return formatSetupCode(code);
}

export const formatSetupCode = (value: string) =>
  normalize(value)
    .match(/.{1,4}/g)!
    .join('-');

/** Compares in constant time; dashes, spaces and case don't matter. */
export function checkSetupCode(input: unknown): boolean {
  return !!code && codeMatches(code, input);
}

/** Called once the password is set. */
export function clearSetupCode() {
  code = undefined;
}

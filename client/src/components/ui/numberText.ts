// One parser for typed whole-number counts and decimal percentages (D-14).
// Pattern-checked before conversion so scientific notation ('1e2'), hex ('0x10'),
// leading plus ('+5'), comma decimals ('1,5') and bare punctuation ('.', '-') are refused.

const WHOLE_NUMBER = /^-?[0-9]+$/;
const DECIMAL_NUMBER = /^-?(?:[0-9]+\.?[0-9]*|\.[0-9]+)$/;

type NormalizedDecimal = { neg: boolean; int: string; frac: string };

/** Normalises a plain or scientific decimal string into exact sign, integer and fractional digits */
function normalizeDecimal(s: string): NormalizedDecimal {
  const neg = s.startsWith('-');
  const unsigned = neg ? s.slice(1) : s;
  const [mantissa, expPart] = unsigned.split(/[eE]/);
  const [rawInt = '0', rawFrac = ''] = mantissa.split('.');
  const lead = rawInt || '0';
  const digits = lead + rawFrac;
  const exp = expPart ? Number(expPart) : 0;
  const point = lead.length + exp;

  let intPart: string;
  let fracPart: string;
  if (point <= 0) {
    intPart = '0';
    fracPart = '0'.repeat(-point) + digits;
  } else if (point >= digits.length) {
    intPart = digits + '0'.repeat(point - digits.length);
    fracPart = '';
  } else {
    intPart = digits.slice(0, point);
    fracPart = digits.slice(point);
  }

  const int = intPart.replace(/^0+/, '') || '0';
  const frac = fracPart.replace(/0+$/, '');
  return { neg: neg && (int !== '0' || frac !== ''), int, frac };
}

function compareNormalized(a: NormalizedDecimal, b: NormalizedDecimal): number {
  if (a.neg !== b.neg) return a.neg ? -1 : 1;
  let mag = 0;
  if (a.int.length !== b.int.length) {
    mag = a.int.length < b.int.length ? -1 : 1;
  } else if (a.int !== b.int) {
    mag = a.int < b.int ? -1 : 1;
  } else if (a.frac !== b.frac) {
    mag = a.frac < b.frac ? -1 : 1;
  }
  return a.neg ? -mag : mag;
}

function withinExactBounds(trimmed: string, min: number, max: number): boolean {
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  if (min === Infinity || max === -Infinity) return false;
  const exact = normalizeDecimal(trimmed);
  if (min !== -Infinity && compareNormalized(exact, normalizeDecimal(String(min))) < 0) {
    return false;
  }
  if (max !== Infinity && compareNormalized(exact, normalizeDecimal(String(max))) > 0) {
    return false;
  }
  return true;
}

/**
 * A whole number typed as plain ASCII digits with an optional leading minus, within [min, max].
 * Surrounding spaces are trimmed; '-0' normalises to 0 when 0 is in bounds.
 */
export function readWholeNumber(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return null;
  const raw = Number(trimmed);
  if (!Number.isSafeInteger(raw)) return null;
  const n = raw === 0 ? 0 : raw;
  return n >= min && n <= max ? n : null;
}

/**
 * A decimal number typed as plain ASCII digits with an optional leading minus and at most one
 * dot (with digits on at least one side), within [min, max]. Exact bounds are checked on the
 * decimal text before float conversion so out-of-range tails never round back into bounds.
 */
export function readDecimal(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!DECIMAL_NUMBER.test(trimmed)) return null;
  if (!withinExactBounds(trimmed, min, max)) return null;
  const raw = Number(trimmed);
  if (!Number.isFinite(raw)) return null;
  const n = raw === 0 ? 0 : raw;
  return n >= min && n <= max ? n : null;
}

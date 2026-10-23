// P3 investments: quantities of a security are stored as integer millionths of a unit, so a
// fractional share or coin is exact.

export const UNIT_SCALE = 1_000_000;

/**
 * A typed quantity ("12", "0.5", "1,25", "1 000.5") in millionths, or null when it isn't one
 * (negative, more than six decimals, or not a number)
 */
export function parseUnits(text: string): number | null {
  let s = text.trim().replace(/[\s']/g, '');
  if (!s) return null;
  // One comma and no point: a decimal comma. Otherwise commas group thousands.
  if (!s.includes('.') && (s.match(/,/g) ?? []).length === 1 && !/,\d{3}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const m = /^(\d+)(?:\.(\d{0,6}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const fraction = Number((m[2] ?? '').padEnd(6, '0'));
  const result = whole * UNIT_SCALE + fraction;
  return Number.isSafeInteger(result) ? result : null;
}

/** Millionths of a unit for showing: "12", "0.5", "1,234.000001" */
export function formatUnits(quantity: number): string {
  const whole = Math.trunc(quantity / UNIT_SCALE);
  const fraction = String(Math.abs(quantity % UNIT_SCALE))
    .padStart(6, '0')
    .replace(/0+$/, '');
  const grouped = whole.toLocaleString('en-US');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** Millionths of a unit for an input field: no grouping */
export function unitsToInput(quantity: number): string {
  return formatUnits(quantity).replace(/,/g, '');
}

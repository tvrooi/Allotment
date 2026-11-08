// Working from home, fixed rate method (docs/TAX-CAR-AND-HOME.md §5.2): hours worked at home
// times a rate per hour. Pure: no database.
import { mulDiv } from './investmentMath.js';

export interface HomeYear {
  minutes: number;
  days: number;
  /** Tenths of a cent per hour; null when the year has no rate */
  rateTenths: number | null;
  /** Cents; 0 without a rate */
  claim: number;
  missing: 'rate'[];
}

/** minutes ÷ 60 × tenths of a cent ÷ 10, in cents, rounded half away from zero */
export function homeClaim(minutes: number, rateTenths: number): number {
  return mulDiv(minutes, rateTenths, 600);
}

export function homeYear(days: { minutes: number }[], rateTenths: number | null): HomeYear {
  const minutes = days.reduce((s, d) => s + d.minutes, 0);
  return {
    minutes,
    days: days.length,
    rateTenths,
    claim: rateTenths === null ? 0 : homeClaim(minutes, rateTenths),
    missing: rateTenths === null ? ['rate'] : [],
  };
}

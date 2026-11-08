// Hours and rates typed on Tax time → Car and home. They are not money, so they are text fields
// (inputMode decimal) turned into whole minutes and tenths of a cent here, in one place.

/** "7.5", "7:30", "7h30" or "7h" as whole minutes (1 to 1,440), or null when it isn't one */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  let minutes: number;
  const clock = /^(\d{1,2})\s*(?::|h)\s*(\d{1,2})?\s*(?:m|min)?$/.exec(t);
  if (clock) {
    // A clock's minutes run 0 to 59: 7:75 is a typo, not 8 h 15 min
    if (Number(clock[2] ?? 0) > 59) return null;
    minutes = Number(clock[1]) * 60 + Number(clock[2] ?? 0);
  } else if (/^\d{1,2}(\.\d{1,2})?$/.test(t)) minutes = Math.round(Number(t) * 60);
  else return null;
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
}

/** 450 as "7 h 30 min", 480 as "8 h", 20 as "20 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** A rate typed in cents per hour ("70" or "71.5") as tenths of a cent, or null when it isn't one */
export function parseRateTenths(text: string): number | null {
  const t = text.trim().replace(/c$/i, '').trim();
  if (!/^\d{1,4}(\.\d)?$/.test(t)) return null;
  const tenths = Math.round(Number(t) * 10);
  return tenths >= 1 && tenths <= 10_000 ? tenths : null;
}

/** 700 as "70c", 715 as "71.5c" */
export const formatRate = (tenths: number): string =>
  `${tenths % 10 ? (tenths / 10).toFixed(1) : tenths / 10}c`;

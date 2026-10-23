import type { ForecastScenarioInput } from '../api/forecast';

// Saved forecast scenarios on the Forecast page: is a scenario changed since it was saved, and
// a free name for a copy

/** Key order doesn't matter, nor whitespace the server trims */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  return typeof value === 'string' ? value.trim() : value;
}

export const sameScenario = (a: ForecastScenarioInput, b: ForecastScenarioInput) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** "Base copy", then "Base copy 2"…, within the 40-character limit and unlike `taken` */
export function copyName(name: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? ' copy' : ` copy ${n}`;
    const candidate = name.trim().slice(0, 40 - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * What the page opens with: the default scenarios, each replaced by a saved one of the same
 * name, then any other saved ones in place of defaults from the end (at most `max`).
 */
export function initialScenarios<S extends { scenario: ForecastScenarioInput }>(
  defaults: ForecastScenarioInput[],
  saved: S[],
  max: number,
): { scenario: ForecastScenarioInput; saved: S | null }[] {
  const key = (name: string) => name.trim().toLowerCase();
  const byName = new Map(saved.map((s) => [key(s.scenario.name), s]));
  const out = defaults.map((d) => {
    const match = byName.get(key(d.name)) ?? null;
    return { scenario: match?.scenario ?? d, saved: match };
  });
  const used = new Set(out.map((o) => o.saved));
  const extras = saved.filter((s) => !used.has(s));
  while (out.length < max && extras.length) {
    const extra = extras.shift()!;
    out.push({ scenario: extra.scenario, saved: extra });
  }
  // The rest replace defaults nobody saved, the last ones first, keeping the saved order
  if (extras.length) {
    const free = out.flatMap((o, i) => (o.saved ? [] : [i])).slice(-extras.length);
    free.forEach((i, n) => (out[i] = { scenario: extras[n].scenario, saved: extras[n] }));
  }
  return out.slice(0, max);
}

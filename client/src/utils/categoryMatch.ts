import type { FileCategory } from './csv';
import type { CategoryGroup } from '../types';

/** Lowercase, punctuation gone, "and" and "&" the same: "Gas / Fuel" and "Gas - Fuel" agree */
const simple = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Names people use for the same thing. Each row is one set, written in simple() form. */
const SYNONYMS = [
  ['public transport', 'public transit', 'transport'],
  ['fuel', 'petrol', 'gas fuel', 'gas'],
  ['rent', 'mortgage', 'rent mortgage'],
  ['restaurants', 'dining out', 'eating out', 'restaurants and cafes'],
  ['coffee', 'coffee shops', 'cafes'],
  ['takeaway', 'fast food'],
  ['electric', 'electricity', 'power'],
  ['internet', 'broadband'],
  ['phone', 'mobile', 'mobile phone'],
  ['groceries', 'supermarket'],
  ['clothing', 'clothes'],
  ['gym', 'gym fitness', 'fitness'],
  ['medical', 'doctor medical', 'doctor', 'health'],
  ['entertainment', 'fun', 'fun money'],
  ['gifts', 'gifts and donations'],
];
const synonymsOf = (name: string) => {
  const key = simple(name);
  return new Set([key, ...SYNONYMS.filter((set) => set.includes(key)).flat()]);
};

/**
 * The existing category that is the same as a file's, as a suggestion the person can change:
 * the same name ignoring case, then ignoring punctuation, then one part of a "Gas / Fuel"
 * style name, then a well known equivalent (Public Transport = Public Transit).
 */
export function matchCategory(
  use: FileCategory,
  groups: CategoryGroup[],
): { group: CategoryGroup; id: string } | undefined {
  const all = groups.flatMap((g) => g.categories.map((c) => ({ g, c })));
  const wanted = simple(use.name);
  const sameGroup = (m: { g: CategoryGroup }) =>
    !!use.group && simple(m.g.name) === simple(use.group);
  const best = (matches: typeof all) => matches.find(sameGroup) ?? matches[0];
  const tiers = [
    (n: string) => n.toLowerCase() === use.name.toLowerCase(),
    (n: string) => simple(n) === wanted,
    (n: string) => n.split('/').some((part) => simple(part) === wanted),
    (n: string) => {
      const equivalents = synonymsOf(use.name);
      return [simple(n), ...n.split('/').map(simple)].some((k) => equivalents.has(k));
    },
  ];
  for (const tier of tiers) {
    const hit = best(all.filter((m) => tier(m.c.name)));
    if (hit) return { group: hit.g, id: hit.c.id };
  }
}

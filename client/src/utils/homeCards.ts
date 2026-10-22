// The home dashboard's cards: which show and in what order, per device and form factor
// (docs/MONARCH-DEVELOPMENT-PHASE.md, "Home dashboard preferences"). Presentation only:
// never budget data, never in backups. Onboarding and the review reminder are not cards.

export const HOME_CARDS = [
  { id: 'net-worth', label: 'Net worth', wide: true },
  { id: 'summary', label: 'Summary', wide: true },
  { id: 'income-expenses', label: 'Income & expenses', wide: false },
  { id: 'spending-comparison', label: 'Spending comparison', wide: false },
  { id: 'budget-progress', label: 'Budget progress', wide: false },
  { id: 'upcoming-bills', label: 'Upcoming bills', wide: false },
  { id: 'spending-breakdown', label: 'Spending breakdown', wide: false },
  { id: 'recent-transactions', label: 'Recent transactions', wide: false },
] as const;

export type HomeCardId = (typeof HOME_CARDS)[number]['id'];
export type FormFactor = 'desktop' | 'phone';

export interface HomeLayout {
  order: HomeCardId[];
  hidden: HomeCardId[];
}

const IDS = HOME_CARDS.map((c) => c.id) as HomeCardId[];
const isCardId = (v: unknown): v is HomeCardId => IDS.includes(v as HomeCardId);

/** Desktop keeps the original arrangement; phones lead with what needs attention today */
export const DEFAULT_LAYOUTS: Record<FormFactor, HomeLayout> = {
  desktop: { order: IDS, hidden: [] },
  phone: {
    order: [
      'summary',
      'upcoming-bills',
      'budget-progress',
      'recent-transactions',
      'net-worth',
      'spending-breakdown',
      'income-expenses',
      'spending-comparison',
    ],
    hidden: [],
  },
};

/**
 * A saved layout made safe to draw: unknown or repeated cards dropped, and cards added since
 * it was saved put where the default has them (shown).
 */
export function normalizeLayout(saved: unknown, factor: FormFactor): HomeLayout {
  const fallback = DEFAULT_LAYOUTS[factor];
  if (!saved || typeof saved !== 'object') return fallback;
  const raw = saved as { order?: unknown; hidden?: unknown };
  const order = Array.isArray(raw.order) ? [...new Set(raw.order.filter(isCardId))] : [];
  for (const id of fallback.order) {
    if (order.includes(id)) continue;
    const before = fallback.order.indexOf(id);
    // After the nearest card that comes before it in the default
    const anchor = fallback.order
      .slice(0, before)
      .reverse()
      .find((other) => order.includes(other));
    order.splice(anchor ? order.indexOf(anchor) + 1 : 0, 0, id);
  }
  const hidden = Array.isArray(raw.hidden) ? [...new Set(raw.hidden.filter(isCardId))] : [];
  return { order, hidden };
}

export function moveCard(layout: HomeLayout, id: HomeCardId, by: -1 | 1): HomeLayout {
  const order = [...layout.order];
  const from = order.indexOf(id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= order.length) return layout;
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}

export function setCardHidden(layout: HomeLayout, id: HomeCardId, hidden: boolean): HomeLayout {
  const rest = layout.hidden.filter((h) => h !== id);
  return { ...layout, hidden: hidden ? [...rest, id] : rest };
}

/** The cards to draw, in order */
export const visibleCards = (layout: HomeLayout) =>
  layout.order.filter((id) => !layout.hidden.includes(id));

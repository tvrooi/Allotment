import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '../../hooks/useCategories';
import { setCategoryHidden } from '../../api/categories';

/** Categories only renters need, and ones only owners need (server/src/db/defaultCategories.ts) */
const ONLY_FOR = {
  rent: ['Rent'],
  own: [
    'Mortgage',
    'Council Rates & Strata',
    'Council Rates & Owners Corp',
    'Property Tax',
    'HOA Fees',
    'Home Maintenance',
  ],
};
const SKIP_KEY = 'budget-rent-or-own-skipped';

function skipped() {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * A new budget's one question: rent or own? The answer tucks away the housing envelopes that
 * don't apply (hidden, never deleted; Settings → Categories brings them back). Shown only while
 * both kinds are still visible.
 */
export function RentOrOwn() {
  const qc = useQueryClient();
  const { data: groups = [] } = useCategories();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(skipped);
  const visible = groups.flatMap((g) => g.categories).filter((c) => !c.hidden);
  const pick = (names: string[]) => visible.filter((c) => names.includes(c.name));
  const renting = pick(ONLY_FOR.rent);
  const owning = pick(ONLY_FOR.own);
  if (dismissed || renting.length === 0 || owning.length === 0) return null;

  async function answer(tuckAway: typeof visible) {
    setBusy(true);
    try {
      for (const c of tuckAway) await setCategoryHidden(c.id, true);
      await qc.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }

  const choice =
    'px-3 py-1.5 max-md:min-h-11 rounded-full border border-border bg-surface text-xs font-medium text-text hover:bg-surface-alt disabled:opacity-50';
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Rent or own">
      <span className="text-text">Do you rent or own your home?</span>
      <button type="button" className={choice} disabled={busy} onClick={() => answer(owning)}>
        I rent
      </button>
      <button type="button" className={choice} disabled={busy} onClick={() => answer(renting)}>
        I own
      </button>
      <button
        type="button"
        className="px-2 py-1.5 max-md:min-h-11 text-xs text-text-tertiary hover:text-text-secondary"
        onClick={() => {
          try {
            localStorage.setItem(SKIP_KEY, '1');
          } catch {
            /* storage blocked: it stays hidden for this visit */
          }
          setDismissed(true);
        }}
      >
        Keep both
      </button>
    </div>
  );
}

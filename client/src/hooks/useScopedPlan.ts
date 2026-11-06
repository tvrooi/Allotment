import { useRef, useState } from 'react';

interface PlanRow {
  categoryId: string;
  name: string;
}

/**
 * A funding preview the person can narrow to chosen categories (BUD-07). The first load is for
 * every category the plan touches; unticking one asks the server for a new preview of the rest,
 * because the money is shared out in order and so every other amount can change. `scope` is
 * exactly what the shown preview was made for, so applying sends the same list. While that new
 * preview is on its way `pending` is true and the shown one no longer matches the ticks, so the
 * dialogs must not offer Apply; a failed request puts the ticks back to match the shown preview.
 */
export function useScopedPlan<P extends { rows: PlanRow[] }>() {
  const [preview, setPreview] = useState<P | null>(null);
  const [candidates, setCandidates] = useState<PlanRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<string[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Only the latest request may set the preview, so a slower earlier answer can't replace it
  const latest = useRef(0);

  /** Opens the plan for every category it touches, or ticked only for `only` (the envelopes
   * selected in the budget table, BUD-10): the rest stay listed, unticked, to add back */
  async function load(fetchPlan: (categoryIds?: string[]) => Promise<P>, only?: string[]) {
    const request = ++latest.current;
    setError(null);
    setPending(false);
    setPreview(null);
    try {
      const plan = await fetchPlan(undefined);
      if (request !== latest.current) return;
      const ids = plan.rows.map((r) => r.categoryId);
      const scoped = only && ids.filter((id) => only.includes(id));
      if (scoped && !scoped.length) {
        setError('None of these envelopes needs money for its target.');
        return;
      }
      const shown = scoped && scoped.length < ids.length ? await fetchPlan(scoped) : plan;
      if (request !== latest.current) return;
      setCandidates(plan.rows.map((r) => ({ categoryId: r.categoryId, name: r.name })));
      setChecked(new Set(scoped ?? ids));
      setScope(shown === plan ? undefined : scoped);
      setPreview(shown);
    } catch (err) {
      if (request === latest.current)
        setError(err instanceof Error ? err.message : 'Could not preview.');
    }
  }
  async function toggle(categoryId: string, fetchPlan: (categoryIds?: string[]) => Promise<P>) {
    const before = checked;
    const next = new Set(checked);
    if (!next.delete(categoryId)) next.add(categoryId);
    setChecked(next);
    setPending(true);
    const request = ++latest.current;
    setError(null);
    const ids = [...next];
    try {
      const plan = await fetchPlan(ids);
      if (request !== latest.current) return;
      setScope(ids);
      setPreview(plan);
      setPending(false);
    } catch (err) {
      if (request !== latest.current) return;
      // The shown preview is still the one for the old ticks
      setChecked(before);
      setPending(false);
      setError(err instanceof Error ? err.message : 'Could not preview.');
    }
  }
  function reset() {
    latest.current++;
    setPreview(null);
    setCandidates([]);
    setChecked(new Set());
    setScope(undefined);
    setError(null);
    setPending(false);
  }
  return { preview, candidates, checked, scope, pending, error, setError, load, toggle, reset };
}

import { useRef, useState } from 'react';

interface PlanRow {
  categoryId: string;
  name: string;
}

/**
 * A funding preview the person can narrow to chosen categories (BUD-07). The first load is for
 * every category the plan touches; unticking one asks the server for a new preview of the rest,
 * because the money is shared out in order and so every other amount can change. `scope` is
 * exactly what the shown preview was made for, so applying sends the same list.
 */
export function useScopedPlan<P extends { rows: PlanRow[] }>() {
  const [preview, setPreview] = useState<P | null>(null);
  const [candidates, setCandidates] = useState<PlanRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<string[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may set the preview, so a slower earlier answer can't replace it
  const latest = useRef(0);

  async function load(fetchPlan: (categoryIds?: string[]) => Promise<P>) {
    const request = ++latest.current;
    setError(null);
    setPreview(null);
    try {
      const plan = await fetchPlan(undefined);
      if (request !== latest.current) return;
      setCandidates(plan.rows.map((r) => ({ categoryId: r.categoryId, name: r.name })));
      setChecked(new Set(plan.rows.map((r) => r.categoryId)));
      setScope(undefined);
      setPreview(plan);
    } catch (err) {
      if (request === latest.current)
        setError(err instanceof Error ? err.message : 'Could not preview.');
    }
  }
  async function toggle(categoryId: string, fetchPlan: (categoryIds?: string[]) => Promise<P>) {
    const next = new Set(checked);
    if (!next.delete(categoryId)) next.add(categoryId);
    setChecked(next);
    const request = ++latest.current;
    setError(null);
    const ids = [...next];
    try {
      const plan = await fetchPlan(ids);
      if (request !== latest.current) return;
      setScope(ids);
      setPreview(plan);
    } catch (err) {
      if (request === latest.current)
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
  }
  return { preview, candidates, checked, scope, error, setError, load, toggle, reset };
}

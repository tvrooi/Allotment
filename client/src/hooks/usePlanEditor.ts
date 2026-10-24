import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../api/longTerm';
import { ApiError } from '../api/client';

// One long-term plan being edited. The plan on screen is a working copy: changes to its
// assumptions, accounts and splits wait for Save. An event is different: opening an editor
// saves nothing, and its Create, Save or Delete saves exactly that change (on top of the
// last saved plan, so other unsaved edits are not swept along). Every save names the version
// it started from; when another device changed or deleted the plan meanwhile nothing is
// overwritten and the owner chooses Use theirs, Keep mine or Save as new.

/** Same data, whatever the key order or undefined fields */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
export const samePlan = (a: api.Plan, b: api.Plan) => stable(a) === stable(b);

export function usePlanEditor(initial: api.SavedPlan) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [working, setWorking] = useState(initial.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Another device's copy after a refused save: null when it was deleted there */
  const [theirs, setTheirs] = useState<api.SavedPlan | null | undefined>(undefined);
  const dirty = !samePlan(working, saved.plan);

  const refresh = (plan: api.SavedPlan) => {
    qc.setQueryData(['lt-plan', plan.id], plan);
    qc.invalidateQueries({ queryKey: ['lt-plans'] });
    qc.invalidateQueries({ queryKey: ['lt-result'] });
    qc.invalidateQueries({ queryKey: ['lt-compare'] });
  };

  /** Save `next` on top of `base`. Returns the saved plan, or null if it was refused. */
  async function persist(next: api.Plan, base: api.SavedPlan = saved) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.updatePlan(base.id, next, base.version);
      setSaved(result);
      setTheirs(undefined);
      refresh(result);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Fetched now, not cached: what the other device saved, or that it is gone
        try {
          const current = await qc.fetchQuery({
            queryKey: ['lt-plan', base.id],
            queryFn: () => api.getPlan(base.id),
            staleTime: 0,
          });
          setTheirs(current);
        } catch (gone) {
          if (gone instanceof ApiError && gone.status === 404) setTheirs(null);
          else setError((gone as Error).message);
        }
        if (!/changed on another device|deleted on another device/.test(e.message))
          setError(e.message);
      } else setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    saved,
    working,
    setWorking,
    dirty,
    busy,
    error,
    setError,
    theirs,
    /** Save the working copy */
    async save() {
      const result = await persist(working);
      if (result) setWorking(result.plan);
      return result;
    },
    revert: () => setWorking(saved.plan),
    /** Save one change (an event added, edited, switched or deleted) without the other edits */
    async commit(change: (plan: api.Plan) => api.Plan) {
      const result = await persist(change(saved.plan));
      if (result) setWorking((w) => change(w));
      return result;
    },
    /** Take the other device's copy and drop my unsaved changes */
    useTheirs() {
      if (!theirs) return;
      setSaved(theirs);
      setWorking(theirs.plan);
      setTheirs(undefined);
      refresh(theirs);
    },
    /** Save mine over theirs (on top of their version), or as a new plan if they deleted it */
    async keepMine() {
      if (theirs) {
        const result = await persist(working, theirs);
        if (result) setWorking(result.plan);
        return result;
      }
      setBusy(true);
      try {
        const copy = await api.createPlan({ ...working, name: `${working.name} (restored)` });
        setSaved(copy);
        setWorking(copy.plan);
        setTheirs(undefined);
        refresh(copy);
        return copy;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
  };
}

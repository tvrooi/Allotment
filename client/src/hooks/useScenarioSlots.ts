import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/forecast';
import { ApiError } from '../api/client';
import { useUndoStore } from '../store/undoStore';
import { copyName, initialScenarios, sameScenario } from '../utils/forecastScenarios';

// The Forecast page's (up to three) scenarios and their saved copies. Saving is explicit; a
// save names the version it started from, and when another device changed or deleted it
// meanwhile the slot shows a conflict instead of overwriting.

export const MAX_SLOTS = 3;
const QK = ['forecast-scenarios'];

export interface Slot {
  uid: number;
  scenario: api.ForecastScenarioInput;
  saved: api.SavedScenario | null;
  /** Another device's copy, after a refused save: null when it was deleted there */
  theirs?: api.SavedScenario | null;
  error?: string | null;
}

let nextUid = 0;
const slotOf = (scenario: api.ForecastScenarioInput, saved: api.SavedScenario | null = null) => ({
  uid: ++nextUid,
  scenario,
  saved,
});

export function useScenarioSlots(defaults: api.ForecastScenarioInput[]) {
  const qc = useQueryClient();
  const savedQuery = useQuery({ queryKey: QK, queryFn: api.getSavedScenarios });
  const [slots, setSlots] = useState<Slot[]>(() => defaults.map((d) => slotOf(d)));
  const started = useRef(false);

  // Start from what was saved, once, so a refresh no longer resets tuned assumptions
  useEffect(() => {
    if (started.current || !savedQuery.isFetched) return;
    started.current = true;
    const saved = savedQuery.data ?? [];
    if (saved.length)
      setSlots(
        initialScenarios(defaults, saved, MAX_SLOTS).map((s) => slotOf(s.scenario, s.saved)),
      );
  }, [savedQuery.isFetched, savedQuery.data, defaults]);

  const scenarios = useMemo(() => slots.map((s) => s.scenario), [slots]);
  const patch = (uid: number, change: Partial<Slot>) =>
    setSlots((cur) => cur.map((s) => (s.uid === uid ? { ...s, ...change } : s)));
  const refresh = () => qc.invalidateQueries({ queryKey: QK });

  /** Refused as stale: show the other device's copy (fetched now, not cached), or that it's gone */
  async function conflict(slot: Slot, error: unknown) {
    if (!(error instanceof ApiError && error.status === 409 && slot.saved)) {
      patch(slot.uid, { error: (error as Error).message });
      return;
    }
    const list = await qc.fetchQuery({
      queryKey: QK,
      queryFn: api.getSavedScenarios,
      staleTime: 0,
    });
    patch(slot.uid, { theirs: list.find((s) => s.id === slot.saved!.id) ?? null });
  }

  async function write(slot: Slot, expectedVersion: number | null) {
    patch(slot.uid, { error: null });
    try {
      const saved =
        slot.saved && expectedVersion !== null
          ? await api.updateSavedScenario(slot.saved.id, slot.scenario, expectedVersion)
          : await api.createSavedScenario(slot.scenario);
      patch(slot.uid, { saved, scenario: saved.scenario, theirs: undefined });
    } catch (error) {
      await conflict(slot, error);
    }
    refresh();
  }

  return {
    slots,
    scenarios,
    /** The forecast waits for the saved list, so it doesn't run the defaults first */
    ready: savedQuery.isFetched,
    available: (savedQuery.data ?? []).filter((s) => !slots.some((x) => x.saved?.id === s.id)),
    isDirty: (slot: Slot) => !slot.saved || !sameScenario(slot.scenario, slot.saved.scenario),

    change: (uid: number, scenario: api.ForecastScenarioInput) => patch(uid, { scenario }),
    save: (slot: Slot) => write(slot, slot.saved?.version ?? null),
    /** After a conflict: take the other device's copy, overwrite it, or save as a new one */
    loadTheirs: (slot: Slot) =>
      slot.theirs &&
      patch(slot.uid, { scenario: slot.theirs.scenario, saved: slot.theirs, theirs: undefined }),
    keepMine: (slot: Slot) =>
      slot.theirs
        ? write(slot, slot.theirs.version)
        : write({ ...slot, saved: null }, null).then(() => patch(slot.uid, { theirs: undefined })),

    duplicate(slot: Slot) {
      if (slots.length >= MAX_SLOTS) return;
      const name = copyName(slot.scenario.name, [
        ...slots.map((s) => s.scenario.name),
        ...(savedQuery.data ?? []).map((s) => s.scenario.name),
      ]);
      setSlots((cur) => [...cur, slotOf({ ...slot.scenario, name })]);
    },
    /** Out of the comparison; a saved copy stays saved */
    remove: (slot: Slot) =>
      slots.length > 1 && setSlots((cur) => cur.filter((s) => s.uid !== slot.uid)),
    open(saved: api.SavedScenario, replace?: Slot) {
      const slot = slotOf(saved.scenario, saved);
      setSlots((cur) =>
        replace
          ? cur.map((s) => (s.uid === replace.uid ? slot : s))
          : [...cur, slot].slice(0, MAX_SLOTS),
      );
    },

    async deleteSaved(slot: Slot) {
      if (!slot.saved) return;
      let copy = slot.saved;
      patch(slot.uid, { error: null });
      try {
        await api.deleteSavedScenario(copy.id, copy.version);
      } catch (error) {
        await conflict(slot, error);
        return;
      }
      patch(slot.uid, { saved: null });
      refresh();
      useUndoStore.getState().push({
        description: `Delete saved scenario "${copy.scenario.name}"`,
        undo: async () => {
          copy = await api.createSavedScenario(copy.scenario);
          patch(slot.uid, { saved: copy });
          refresh();
        },
        redo: async () => {
          await api.deleteSavedScenario(copy.id, copy.version);
          patch(slot.uid, { saved: null });
          refresh();
        },
      });
    },
  };
}

import { useState } from 'react';
import type { HouseholdSplit } from '../../api/households';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';

// How an amount is split between a household's people: equal, percentages or weights. Saves
// percentages in basis points (40% → 4000), as the server keeps them.

interface Props {
  people: { id: string; name: string }[];
  current: HouseholdSplit | null;
  /** What "Equal" means here, e.g. "Equal" or "The household's default split" */
  equalLabel?: string;
  saving?: boolean;
  onSave: (split: HouseholdSplit | null) => void;
  onCancel?: () => void;
}

export function SplitEditor({ people, current, equalLabel, saving, onSave, onCancel }: Props) {
  const [mode, setMode] = useState<HouseholdSplit['mode']>(current?.mode ?? 'equal');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      people.map((p) => {
        const v = current?.shares.find((s) => s.personId === p.id)?.value;
        return [p.id, v === undefined ? '' : String(current?.mode === 'percentage' ? v / 100 : v)];
      }),
    ),
  );
  function save() {
    if (mode === 'equal') return onSave(null);
    onSave({
      mode,
      shares: people.map((p) => {
        const n = Number(values[p.id] || 0);
        return {
          personId: p.id,
          value: mode === 'percentage' ? Math.round(n * 100) : Math.round(n),
        };
      }),
    });
  }
  return (
    <div className="grid gap-2">
      <Select
        aria-label="Split"
        value={mode}
        onChange={(e) => setMode(e.target.value as HouseholdSplit['mode'])}
      >
        <option value="equal">{equalLabel ?? 'Equal'}</option>
        <option value="percentage">Percentages</option>
        <option value="weight">Weights (for example 2 : 1 : 1)</option>
      </Select>
      {mode !== 'equal' &&
        people.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="w-24 truncate">{p.name}</span>
            <Input
              aria-label={`${p.name}'s ${mode === 'percentage' ? 'percentage' : 'weight'}`}
              inputMode="decimal"
              value={values[p.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
            />
            {mode === 'percentage' && '%'}
          </label>
        ))}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
          Save split
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/** "equal between everyone", or "Me 50%, Sam 25%, Jo 25%" / "Me ×2, Sam ×1" */
export function describeSplit(s: HouseholdSplit | null, people: { id: string; name: string }[]) {
  return !s || s.mode === 'equal'
    ? 'equal between everyone'
    : s.shares
        .map(
          (x) =>
            `${people.find((p) => p.id === x.personId)?.name ?? '?'} ${s.mode === 'percentage' ? `${x.value / 100}%` : `×${x.value}`}`,
        )
        .join(', ');
}

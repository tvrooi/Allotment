import { Checkbox } from '../ui/Checkbox';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setHouseholdIncludesBills } from '../../api/households';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';

// Household → Settings → Bills: whether this household includes bills. A flat with a shared
// account does; two people splitting groceries and outings need not. Off only hides bills and
// what the household account covers: nothing is deleted, and turning it back on restores them.

const card = 'bg-surface rounded-lg shadow-card border border-border-light p-4';

interface Props {
  groupId: string;
  includeBills: boolean;
}

export function HouseholdBills({ groupId, includeBills }: Props) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const [error, setError] = useState('');
  const toggle = useMutation({
    mutationFn: (on: boolean) => setHouseholdIncludesBills(groupId, on),
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['households'] });
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <section className={card} aria-labelledby="household-bills-setting">
      <h2 id="household-bills-setting" className="text-base font-semibold text-text">
        Bills
      </h2>
      <Checkbox
        className="mt-2"
        checked={includeBills}
        disabled={!canSave || toggle.isPending}
        onCheckedChange={(checked) => toggle.mutate(checked)}
        description="On: recurring and one-off bills, and what the household account covers. Off: just shared costs and who owes whom, like splitting groceries and outings. Turning it off hides bills; nothing is deleted."
      >
        Include bills in this household
      </Checkbox>
      {error && (
        <p role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      )}
      <SavingPausedHint className="mt-1" />
    </section>
  );
}

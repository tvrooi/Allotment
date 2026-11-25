import { useId, useState } from 'react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { changeGoalStatus } from '../../api/goals';
import { getReview } from '../../api/review';
import { useBudget } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import type { Goal, GoalStatus } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { FUNDING_VIEWS } from '../../utils/fundingViews';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Modal } from '../ui/Modal';

// Goals can change (phase 7D). Pausing, completing or retiring keeps the goal's money where it
// is unless the user chooses to move some in the same confirmed action.

const VERB: Record<GoalStatus, string> = {
  active: 'Resume',
  paused: 'Pause',
  completed: 'Mark completed',
  retired: 'Retire',
};
const EXPLAIN: Record<GoalStatus, string> = {
  active: 'Funding suggestions start again from its target and payday rules.',
  paused: 'Its money stays reserved. Targets and payday plans stop suggesting more.',
  completed: 'Its money stays reserved for the purpose. No more funding is suggested.',
  retired:
    'The goal and its history stay. Its money stays in its category unless you move it below.',
};

/** The replacement list's "No replacement" row (a Combobox option needs a value of its own) */
const NO_REPLACEMENT = '__none__';
/** The destination picker's pinned "Keep it in …" row: no move */
const KEEP = '__keep__';

export function GoalStatusModal({
  goal,
  status,
  goals,
  isOpen,
  onClose,
}: {
  goal: Goal;
  status: GoalStatus;
  goals: Goal[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const month = format(new Date(), 'yyyy-MM');
  const budget = useBudget(month);
  const review = useQuery({ queryKey: ['review'], queryFn: getReview, enabled: isOpen });
  const [reason, setReason] = useState('');
  const [replacement, setReplacement] = useState('');
  const [destination, setDestination] = useState('');
  const [moveCents, setMoveCents] = useState(0);
  // Whether the amount field's text, as typed, is an amount (CurrencyInput keeps text that isn't
  // and reports it); a field that goes away (Keep it in …) no longer holds the confirm up
  const { allValid, report } = useAmountValidity();
  const destinationId = useId();
  const amountId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const available = goal.available ?? 0;
  const categories = (budget.data ?? [])
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories)
    .filter((c) => c.id !== goal.categoryId && !c.paymentAccountId);
  const categoryIds = categories.map((c) => c.id);
  const availableHint = (id: string) => {
    const c = categories.find((cat) => cat.id === id);
    return c ? `(${formatCurrency(c.balance)} available)` : '';
  };
  const canMove = status !== 'active' && !!goal.categoryId && available > 0;
  const replacements = goals.filter((g) => g.id !== goal.id && g.status !== 'retired');

  async function confirm() {
    setError(null);
    if (destination && (!allValid || moveCents <= 0 || moveCents > available)) {
      setError(`Enter an amount up to ${formatCurrency(available)}.`);
      return;
    }
    setBusy(true);
    try {
      await changeGoalStatus(goal.id, {
        status,
        reason: reason.trim() || null,
        replacementGoalId: status !== 'active' && replacement ? replacement : null,
        expectedUpdatedAt: (goals.find((g) => g.id === goal.id) ?? goal).updatedAt,
        move:
          destination && moveCents > 0 && review.data
            ? { destinationId: destination, amount: moveCents, revision: review.data.revision }
            : null,
      });
      for (const key of [...FUNDING_VIEWS, 'budget-moves', 'category-history'])
        await qc.invalidateQueries({ queryKey: [key] });
      onClose();
    } catch (err) {
      // A changed budget or goal is refused; refresh both so the next attempt is current.
      await qc.invalidateQueries({ queryKey: ['review'] });
      await qc.invalidateQueries({ queryKey: ['goals'] });
      setError(err instanceof Error ? err.message : 'Could not change the goal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${VERB[status]} “${goal.name}”`}>
      <div className="space-y-3 text-sm">
        <p className="text-text-secondary">{EXPLAIN[status]}</p>
        <Field label="Reason (optional)">
          <Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {status !== 'active' && replacements.length > 0 && (
          <Combobox
            label="Replaced by (optional)"
            items={[
              { value: NO_REPLACEMENT, label: 'No replacement' },
              ...replacements.map((g) => ({ value: g.id, label: g.name })),
            ]}
            value={replacement || NO_REPLACEMENT}
            // Text that matches no goal returns to the chosen one; it is never emptied
            onChange={(v) => {
              if (v) setReplacement(v === NO_REPLACEMENT ? '' : v);
            }}
          />
        )}
        {canMove && (
          <AmountFields report={report}>
            <fieldset className="space-y-2 rounded-lg bg-surface-alt p-3">
              <legend className="text-xs font-medium text-text-secondary">
                Move money now (optional) · {formatCurrency(available)} available
              </legend>
              <div className="grid gap-1">
                <Label htmlFor={destinationId}>To category</Label>
                <CategorySelectButton
                  id={destinationId}
                  label="Move to category"
                  value={destination || KEEP}
                  onChange={(id) => setDestination(id && id !== KEEP ? id : '')}
                  categoryIds={categoryIds}
                  hint={availableHint}
                  extraItem={{
                    value: KEEP,
                    label: `Keep it in ${goal.categoryName ?? 'its category'}`,
                  }}
                  allowNone={false}
                  allowCreate={false}
                  includeHidden
                />
              </div>
              {destination && (
                <div className="grid gap-1">
                  <Label htmlFor={amountId}>Amount</Label>
                  <CurrencyInput
                    id={amountId}
                    aria-label="Amount to move"
                    // Signed, so a typed negative meets the positive-amount check instead of becoming positive
                    allowNegative
                    value={moveCents}
                    onChange={setMoveCents}
                    // As typed, so the line below follows each keystroke
                    onTextChange={(cents) => {
                      if (cents !== null) setMoveCents(cents);
                    }}
                  />
                </div>
              )}
              {destination && allValid && moveCents > 0 && moveCents <= available && (
                <p role="status" className="text-xs text-text-secondary">
                  {formatCurrency(available - moveCents)} stays with the goal;{' '}
                  {formatCurrency(moveCents)} moves. Total money is unchanged. To return money to
                  Ready to assign instead, lower the assignment on the budget.
                </p>
              )}
            </fieldset>
          </AmountFields>
        )}
        {error && (
          <p role="alert" className="text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || busy || !allValid} onClick={confirm}>
            {VERB[status]}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

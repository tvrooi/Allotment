import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { changeGoalStatus } from '../../api/goals';
import { getReview } from '../../api/review';
import { useBudget } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import type { Goal, GoalStatus } from '../../types';
import { formatCurrency, isUnreadableAmount, parseCents } from '../../utils/currency';
import { FUNDING_VIEWS } from '../../utils/fundingViews';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
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
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const available = goal.available ?? 0;
  const categories = (budget.data ?? [])
    .filter((g) => !g.isIncome)
    .flatMap((g) => g.categories)
    .filter((c) => c.id !== goal.categoryId && !c.paymentAccountId);
  const canMove = status !== 'active' && !!goal.categoryId && available > 0;
  const moveCents = amount ? parseCents(amount) : 0;
  const replacements = goals.filter((g) => g.id !== goal.id && g.status !== 'retired');

  async function confirm() {
    setError(null);
    if (destination && (isUnreadableAmount(amount) || moveCents <= 0 || moveCents > available)) {
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

  const label = 'grid gap-1 text-xs font-medium text-text-secondary';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${VERB[status]} “${goal.name}”`}>
      <div className="space-y-3 text-sm">
        <p className="text-text-secondary">{EXPLAIN[status]}</p>
        <label className={label}>
          Reason (optional)
          <Input
            aria-label="Reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {status !== 'active' && replacements.length > 0 && (
          <label className={label}>
            Replaced by (optional)
            <Select
              aria-label="Replacement goal"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            >
              <option value="">No replacement</option>
              {replacements.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {canMove && (
          <fieldset className="space-y-2 rounded-lg bg-surface-alt p-3">
            <legend className="text-xs font-medium text-text-secondary">
              Move money now (optional) · {formatCurrency(available)} available
            </legend>
            <label className={label}>
              To category
              <Select
                aria-label="Move to category"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Keep it in {goal.categoryName ?? 'its category'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatCurrency(c.balance)} available)
                  </option>
                ))}
              </Select>
            </label>
            {destination && (
              <label className={label}>
                Amount
                <Input
                  aria-label="Amount to move"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            {destination && moveCents > 0 && moveCents <= available && (
              <p role="status" className="text-xs text-text-secondary">
                {formatCurrency(available - moveCents)} stays with the goal;{' '}
                {formatCurrency(moveCents)} moves. Total money is unchanged. To return money to
                unassigned instead, lower the assignment on the budget.
              </p>
            )}
          </fieldset>
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
          <Button disabled={!canSave || busy} onClick={confirm}>
            {VERB[status]}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

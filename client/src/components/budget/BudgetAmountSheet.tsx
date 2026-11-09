import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BulkPreview } from './BulkPreview';
import { useCategoryHistory, useSetCategoryNote } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import {
  centsToInput,
  formatCurrency,
  amountPlaceholder,
  UNREADABLE_AMOUNT,
} from '../../utils/currency';
import { assignmentToInput, readAmountExpression } from '../../utils/amountExpression';
import { NoteField } from './NoteField';
import type { BudgetCategory } from '../../types';

interface Props {
  category: BudgetCategory | null;
  isIncome: boolean;
  month: string;
  onClose: () => void;
  /** Resolves to why the save was refused, or null once it has been saved */
  onSave: (categoryId: string, cents: number) => Promise<string | null>;
  /** Sets the amount for this month and the 11 after it */
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
}

/**
 * Phones: planning a category's amount in a sheet (the desktop edits in place). Shows
 * last month and the monthly average, which can be used with one tap.
 */
export function BudgetAmountSheet({
  category,
  isIncome,
  month,
  onClose,
  onSave,
  onApplyBulk,
}: Props) {
  return (
    <Modal
      isOpen={category !== null}
      onClose={onClose}
      title={category ? `Plan ${category.name}` : 'Plan'}
      size="sm"
    >
      {category && (
        // Keyed so reopening for another category starts fresh
        <SheetBody
          key={category.id}
          category={category}
          isIncome={isIncome}
          month={month}
          onClose={onClose}
          onSave={onSave}
          onApplyBulk={onApplyBulk}
        />
      )}
    </Modal>
  );
}

function SheetBody({
  category,
  isIncome,
  month,
  onClose,
  onSave,
  onApplyBulk,
}: Omit<Props, 'category'> & { category: BudgetCategory }) {
  const [raw, setRaw] = useState(assignmentToInput(category.budgeted));
  const [allYear, setAllYear] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  // Shown after Save with text that isn't an amount, until the text changes
  const [invalid, setInvalid] = useState(false);
  // The sheet closes once the server has saved; a refused amount stays here with its reason
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const { data: history } = useCategoryHistory(category.id, month);
  const canSave = useCanSave();
  const setNote = useSetCategoryNote();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    // A sum (100+50) is worked out; a minus sign means what it does on a desktop (BUD-05)
    const cents = readAmountExpression(raw);
    if (cents === null) {
      setInvalid(true);
      return;
    }
    // Twelve months are only overwritten after their preview is reviewed below.
    if (allYear) return setReview(cents);
    setSaving(true);
    setRefused(null);
    const reason = await onSave(category.id, cents);
    setSaving(false);
    if (reason === null) onClose();
    else setRefused(reason);
  }

  const suggestions = [
    { label: isIncome ? 'Earned last month' : 'Spent last month', cents: history?.lastMonth },
    { label: 'Monthly average', cents: history?.average },
  ].filter((s): s is { label: string; cents: number } => !!s.cents);

  return (
    <form onSubmit={save} className="grid gap-4">
      <p className="text-sm text-text-secondary">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</p>
      <label className="grid gap-1">
        <span className="text-sm font-medium text-text-secondary">
          {isIncome ? 'Expected' : 'Assigned'}
        </span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          aria-label={`Assigned to ${category.name}`}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setInvalid(false);
            setRefused(null);
          }}
          readOnly={saving}
          placeholder={amountPlaceholder()}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'planned-amount-hint' : undefined}
          className={`w-full rounded-md border bg-surface px-3 py-2.5 text-right tabular-nums text-text focus:outline-none focus:ring-1 ${
            invalid
              ? 'border-negative focus:border-negative focus:ring-negative'
              : 'border-border focus:border-brand-600 focus:ring-brand-600'
          }`}
        />
        {invalid && (
          <span id="planned-amount-hint" role="alert" className="text-xs text-negative">
            {UNREADABLE_AMOUNT}
          </span>
        )}
      </label>

      {suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setRaw(centsToInput(s.cents))}
              className="min-h-11 rounded-lg bg-surface-alt px-3 py-2 text-left"
            >
              <span className="block text-sm font-semibold tabular-nums text-text">
                {formatCurrency(s.cents)}
              </span>
              <span className="block text-xs text-text-tertiary">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={allYear}
          onChange={(e) => {
            setAllYear(e.target.checked);
            setReview(null);
          }}
          className="h-5 w-5 accent-brand-600"
        />
        Use this amount for the next 12 months
      </label>

      {review !== null && (
        <BulkPreview
          categoryId={category.id}
          cents={review}
          month={month}
          onCancel={() => setReview(null)}
          onConfirm={(expected) => {
            onApplyBulk(category.id, review, expected);
            onClose();
          }}
        />
      )}

      <NoteField
        label={`Note for ${category.name}`}
        note={category.note ?? ''}
        onSave={(note) => setNote.mutateAsync({ categoryId: category.id, note })}
      />

      {refused && (
        <p role="status" className="text-sm text-negative">
          Not saved. {refused}
        </p>
      )}
      <SavingPausedHint />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 flex-1" disabled={!canSave || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

import { useId, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Label } from '../ui/Label';
import { BulkPreview } from './BulkPreview';
import { useCategoryHistory, useSetCategoryNote } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { formatCurrency, UNREADABLE_AMOUNT } from '../../utils/currency';
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
  const [cents, setCents] = useState(category.budgeted);
  // Live parsed amount (or null while unreadable), so Enter submits without waiting for blur
  const [draft, setDraft] = useState<number | null>(category.budgeted);
  const [version, setVersion] = useState(0);
  const [allYear, setAllYear] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  // The sheet closes once the server has saved; a refused amount stays here with its reason
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  // Shown when Enter submits unreadable text while focused (CurrencyInput shows its own alert on blur)
  const [invalidSubmit, setInvalidSubmit] = useState(false);
  const [blurredInvalid, setBlurredInvalid] = useState(false);
  const amountId = useId();
  const { data: history } = useCategoryHistory(category.id, month);
  const canSave = useCanSave();
  const setNote = useSetCategoryNote();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    if (draft === null) {
      if (!blurredInvalid) setInvalidSubmit(true);
      return;
    }
    // Twelve months are only overwritten after their preview is reviewed below.
    if (allYear) return setReview(draft);
    setSaving(true);
    setRefused(null);
    const reason = await onSave(category.id, draft);
    setSaving(false);
    if (reason === null) onClose();
    else setRefused(reason);
  }

  const suggestions = [
    { label: isIncome ? 'Earned last month' : 'Spent last month', cents: history?.lastMonth },
    { label: 'Monthly average', cents: history?.average },
  ].filter((s): s is { label: string; cents: number } => !!s.cents);

  return (
    <form onSubmit={save} noValidate className="grid gap-4">
      <p className="text-sm text-text-secondary">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</p>
      <div className="grid gap-1">
        <Label htmlFor={amountId}>{isIncome ? 'Expected' : 'Assigned'}</Label>
        <CurrencyInput
          key={version}
          id={amountId}
          value={cents}
          onChange={(next) => {
            setCents(next);
            setDraft(next);
            setInvalidSubmit(false);
            setBlurredInvalid(false);
          }}
          onTextChange={(next) => {
            setDraft(next);
            setInvalidSubmit(false);
            if (next !== null) setBlurredInvalid(false);
            setRefused(null);
          }}
          onBlur={() => {
            setBlurredInvalid(draft === null);
            if (draft === null) setInvalidSubmit(false);
          }}
          expression
          allowNegative
          autoFocus={version === 0}
          readOnly={saving}
          aria-busy={saving || undefined}
          aria-label={`Assigned to ${category.name}`}
          className="text-right tabular-nums max-md:text-base"
        />
        {invalidSubmit && (
          <p role="alert" className="text-xs text-negative">
            {UNREADABLE_AMOUNT}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setCents(s.cents);
                setDraft(s.cents);
                setVersion((v) => v + 1);
                setInvalidSubmit(false);
                setBlurredInvalid(false);
                setRefused(null);
              }}
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

      <Checkbox
        checked={allYear}
        onCheckedChange={(checked) => {
          setAllYear(checked);
          setReview(null);
        }}
        className="gap-3"
      >
        Use this amount for the next 12 months
      </Checkbox>

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

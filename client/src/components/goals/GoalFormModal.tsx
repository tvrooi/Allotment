import { useState, useEffect, useId } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import type { Goal } from '../../types';
import { CategoryIcon } from '../ui/CategoryIcon';

/** The app's line icons, by name (no emoji): see utils/categoryIcons.ts */
const ICONS = [
  'PiggyBank',
  'House',
  'Plane',
  'Car',
  'Coins',
  'GraduationCap',
  'Gem',
  'Palmtree',
  'Laptop',
  'LifeBuoy',
  'Gift',
  'Baby',
];
/** The Linked account list's "None" row (a Combobox option needs a value of its own) */
const NO_ACCOUNT = '__none__';
const COLORS = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#4F46E5',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    categoryId: string | null;
    targetDate: string | null;
    accountId: string | null;
    icon: string;
    color: string;
  }) => Promise<unknown>;
  editGoal?: Goal | null;
}

function startingValues(goal: Goal | null | undefined) {
  return {
    categoryId: goal?.categoryId ?? '',
    name: goal?.name ?? '',
    targetAmount: goal?.targetAmount ?? 0,
    currentAmount: goal?.currentAmount ?? 0,
    targetDate: goal?.targetDate ?? '',
    accountId: goal?.accountId ?? '',
    icon: goal?.icon ?? 'PiggyBank',
    color: goal?.color ?? '#2563EB',
  };
}

export function GoalFormModal({ isOpen, onClose, onSave, editGoal }: Props) {
  const fieldId = useId();
  const { data: accounts = [] } = useAccounts();

  const { data: groups = [] } = useCategories();
  const expenseGroups = groups.filter((g) => !g.isIncome);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [icon, setIcon] = useState('PiggyBank');
  const [color, setColor] = useState('#2563EB');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // What the form opens with: a new goal's defaults, or the goal being edited
  const start = startingValues(editGoal);
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setCategoryId(start.categoryId);
    setName(start.name);
    setTargetAmount(start.targetAmount);
    setCurrentAmount(start.currentAmount);
    setTargetDate(start.targetDate);
    setAccountId(start.accountId);
    setIcon(start.icon);
    setColor(start.color);
    // `start` follows editGoal; a new object each render must not reset what's typed
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start is derived from editGoal
  }, [isOpen, editGoal]);

  // Anything changed from that, so closing by Escape or outside asks first (UX audit AU-007)
  const now = { categoryId, name, targetAmount, currentAmount, targetDate, accountId, icon, color };
  const dirty = (Object.keys(start) as (keyof typeof start)[]).some((k) => now[k] !== start[k]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || targetAmount <= 0) return;
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        targetAmount,
        ...(categoryId ? {} : { currentAmount }),
        categoryId: categoryId || null,
        targetDate: targetDate || null,
        accountId: accountId || null,
        icon,
        color,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save goal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editGoal ? 'Edit goal' : 'Add goal'}
      size="sm"
      dirty={dirty && !saving}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Fund"
            autoFocus
          />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-source`}>Progress source</Label>
          {/* The expense categories, hidden ones included, as the list offered before (G3) */}
          <CategorySelectButton
            id={`${fieldId}-source`}
            label="Progress source"
            value={categoryId || null}
            onChange={(id) => setCategoryId(id ?? '')}
            groups={expenseGroups}
            allowNone
            noneLabel="Manual tracking"
            allowCreate={false}
            includeHidden
          />
          <p className="text-xs text-text-secondary">
            Category goals use available budget money. Assigning funds increases progress; spending
            or moving funds reduces it. Each category can fund one goal. Account links are for
            reference only.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-target`}>Target</Label>
            <CurrencyInput
              id={`${fieldId}-target`}
              value={targetAmount}
              onChange={setTargetAmount}
              className="w-full"
              aria-label="Target"
            />
          </div>
          {!categoryId && (
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-saved`}>Saved so far</Label>
              <CurrencyInput
                id={`${fieldId}-saved`}
                value={currentAmount}
                onChange={setCurrentAmount}
                className="w-full"
                aria-label="Saved so far"
              />
            </div>
          )}
        </div>

        <DatePicker
          label="Target date (optional)"
          errorLabel="target date"
          value={targetDate}
          onChange={setTargetDate}
          optional
        />

        <Combobox
          label="Linked account (optional)"
          items={[
            { value: NO_ACCOUNT, label: 'None' },
            ...accounts.filter((a) => !a.closedAt).map((a) => ({ value: a.id, label: a.name })),
          ]}
          value={accountId || NO_ACCOUNT}
          // Text that matches no account returns to the chosen one; it is never emptied
          onChange={(v) => {
            if (v) setAccountId(v === NO_ACCOUNT ? '' : v);
          }}
        />

        <div className="space-y-1.5">
          <span id={`${fieldId}-icon`} className="text-sm font-medium text-text-secondary">
            Icon
          </span>
          <div role="group" aria-labelledby={`${fieldId}-icon`} className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-pressed={icon === i}
                aria-label={i.replace(/([a-z])([A-Z])/g, '$1 $2')}
                className={`w-9 h-9 flex items-center justify-center rounded-md border transition-colors ${
                  icon === i ? 'border-brand-500 bg-brand-50' : 'border-border-light hover:bg-hover'
                }`}
              >
                <CategoryIcon icon={i} size={18} className="text-text-secondary" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span id={`${fieldId}-colour`} className="text-sm font-medium text-text-secondary">
            Colour
          </span>
          <div role="group" aria-labelledby={`${fieldId}-colour`} className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  color === c ? 'border-text scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || targetAmount <= 0}>
            {editGoal ? 'Save' : 'Add goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

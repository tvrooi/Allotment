import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import type { Goal } from '../../types';

const ICONS = ['🎯', '🏠', '✈️', '🚗', '💰', '🎓', '💍', '🏖️', '📱', '🛡️', '🎁', '⭐'];
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

export function GoalFormModal({ isOpen, onClose, onSave, editGoal }: Props) {
  const { data: accounts = [] } = useAccounts();

  const { data: groups = [] } = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#2563EB');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setError('');
    if (isOpen && editGoal) {
      setCategoryId(editGoal.categoryId ?? '');
      setName(editGoal.name);
      setTargetAmount(editGoal.targetAmount);
      setCurrentAmount(editGoal.currentAmount);
      setTargetDate(editGoal.targetDate ?? '');
      setAccountId(editGoal.accountId ?? '');
      setIcon(editGoal.icon);
      setColor(editGoal.color);
    } else if (isOpen) {
      setCategoryId('');
      setName('');
      setTargetAmount(0);
      setCurrentAmount(0);
      setTargetDate('');
      setAccountId('');
      setIcon('🎯');
      setColor('#2563EB');
    }
  }, [isOpen, editGoal]);

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
    <Modal isOpen={isOpen} onClose={onClose} title={editGoal ? 'Edit Goal' : 'Add Goal'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Fund"
            aria-label="Name"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Progress source</label>
          <select
            aria-label="Progress source"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-text"
          >
            <option value="">Manual tracking</option>
            {groups
              .filter((g) => !g.isIncome)
              .flatMap((g) => g.categories)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <p className="text-xs text-text-secondary">
            Category goals use available budget money. Assigning funds increases progress; spending
            or moving funds reduces it. Each category can fund one goal. Account links are for
            reference only.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Target</label>
            <CurrencyInput
              value={targetAmount}
              onChange={setTargetAmount}
              className="w-full"
              aria-label="Target"
            />
          </div>
          {!categoryId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Saved so far</label>
              <CurrencyInput
                value={currentAmount}
                onChange={setCurrentAmount}
                className="w-full"
                aria-label="Saved so far"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Target date (optional)</label>
          <input
            type="date"
            aria-label="Target date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Linked account (optional)
          </label>
          <select
            aria-label="Linked account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
          >
            <option value="">None</option>
            {accounts
              .filter((a) => !a.closedAt)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-pressed={icon === i}
                className={`w-9 h-9 text-lg rounded-md border transition-colors ${
                  icon === i ? 'border-brand-500 bg-brand-50' : 'border-border-light hover:bg-hover'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
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
            {editGoal ? 'Save' : 'Add Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

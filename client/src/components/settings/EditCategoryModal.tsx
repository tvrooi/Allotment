import { useId, useState, useRef } from 'react';
import { useFormReset } from '../../hooks/useFormReset';
import { useCanSave } from '../../hooks/useConnection';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Radio, RadioGroup } from '../ui/RadioGroup';
import { IconPickerPopover } from '../ui/IconPickerPopover';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useUpdateCategory } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { usePreferencesStore } from '../../store/preferencesStore';
import type { BudgetType, Category, CategoryGroup } from '../../types';

// Combobox treats '' as unselected, so account "none" options use a non-empty sentinel key
const NONE_ACCOUNT = '__none__';

const BUDGET_TYPE_OPTIONS: { value: BudgetType; label: string; description: string }[] = [
  { value: 'fixed', label: 'Fixed', description: 'Consistent, predictable monthly amount' },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Variable spending that changes each month',
  },
  { value: 'non_monthly', label: 'Non-Monthly', description: 'Periodic or irregular expenses' },
  {
    value: 'savings',
    label: 'Savings/Investments',
    description: 'Savings goals and investment contributions',
  },
];

interface Props {
  category: Category | null;
  groups: CategoryGroup[];
  isIncome: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function EditCategoryModal({ category, groups, isIncome, onClose, onDelete }: Props) {
  const nameId = useId();
  const canSave = useCanSave();
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const updateCategory = useUpdateCategory();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [groupId, setGroupId] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('flexible');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [poolAccountId, setPoolAccountId] = useState('');
  const [keepOverspending, setKeepOverspending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: accounts } = useAccounts();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Filled once per opening, not on every refetch of the categories (that would undo edits)
  useFormReset(category?.id ?? null, () => {
    if (!category) return;
    setName(category.name);
    setIcon(category.icon ?? '');
    setGroupId(category.groupId);
    setBudgetType((category.budgetType as BudgetType) ?? 'flexible');
    setLinkedAccountId(category.linkedAccountId ?? '');
    setPoolAccountId(category.poolAccountId ?? '');
    setKeepOverspending(category.keepOverspending === 1);
    setError(null);
    setShowEmojiPicker(false);
  });

  if (!category) return null;

  const applicableGroups = groups.filter((g) => (isIncome ? g.isIncome === 1 : g.isIncome === 0));
  const groupLocked = isIncome && applicableGroups.length <= 1;
  // Accounts an envelope can follow: open cash accounts in the budget (the server checks the rest)
  const linkable = (accounts ?? []).filter(
    (a) =>
      !a.isOffBudget &&
      (!a.closedAt || a.id === category.linkedAccountId) &&
      ['checking', 'savings', 'cash'].includes(a.type),
  );

  // Accounts with their own Ready to Assign (Edit account → Own Ready to assign)
  const pools = (accounts ?? []).filter((a) => a.assignPool === 1 && !a.closedAt);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !name.trim() || !canSave) return;

    const data: Record<string, unknown> = {};
    if (name.trim() !== category.name) data.name = name.trim();
    if ((icon || null) !== (category.icon || null)) data.icon = icon || null;
    if (groupId !== category.groupId) data.groupId = groupId;
    if (!isIncome && budgetType !== (category.budgetType ?? 'flexible'))
      data.budgetType = budgetType;
    if (!isIncome && (linkedAccountId || null) !== (category.linkedAccountId ?? null))
      data.linkedAccountId = linkedAccountId || null;
    if (!isIncome && (poolAccountId || null) !== (category.poolAccountId ?? null))
      data.poolAccountId = poolAccountId || null;
    if (!isIncome && keepOverspending !== (category.keepOverspending === 1))
      data.keepOverspending = keepOverspending ? 1 : 0;

    if (Object.keys(data).length > 0) {
      try {
        await updateCategory.mutateAsync({ id: category.id, data });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the category');
        return;
      }
    }
    onClose();
  }

  return (
    <Modal isOpen={!!category} onClose={onClose} title="Edit category" size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-1">
          <Label htmlFor={nameId}>Icon & Name</Label>
          <div className="flex items-center gap-3">
            {showCategoryIcons && (
              <div className="relative shrink-0">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  aria-label="Change icon"
                  className="text-xl w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:bg-hover transition-colors"
                >
                  <CategoryIcon icon={icon || 'Package'} size={20} />
                </button>
                {showEmojiPicker && (
                  <IconPickerPopover
                    anchorRef={emojiButtonRef}
                    onSelect={setIcon}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>
            )}
            <Input
              id={nameId}
              aria-label="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </div>
        </div>

        <Combobox
          label="Group"
          items={applicableGroups.map((g) => ({ value: g.id, label: g.name }))}
          value={groupId}
          onChange={(v) => {
            if (v) setGroupId(v);
          }}
          isDisabled={groupLocked}
        />

        {!isIncome && (
          <RadioGroup
            label="Budget type"
            value={budgetType}
            onChange={(v) => setBudgetType(v as BudgetType)}
            className="w-full [&>div]:w-full"
          >
            {BUDGET_TYPE_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={`rounded-lg border transition-colors [&_label]:flex [&_label]:w-full [&_label]:items-start [&_label]:gap-3 [&_label]:p-3 ${
                  budgetType === opt.value
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-border hover:bg-hover'
                }`}
              >
                <Radio value={opt.value}>
                  <span className="block text-sm font-medium text-text">{opt.label}</span>
                  <span className="block text-xs text-text-tertiary">{opt.description}</span>
                </Radio>
              </div>
            ))}
          </RadioGroup>
        )}

        {!isIncome && (
          <Combobox
            label="Follows the account"
            items={[
              { value: NONE_ACCOUNT, label: 'No account' },
              ...linkable.map((a) => ({ value: a.id, label: a.name })),
            ]}
            value={linkedAccountId || NONE_ACCOUNT}
            onChange={(v) => {
              if (v) setLinkedAccountId(v === NONE_ACCOUNT ? '' : v);
            }}
            description="This envelope holds exactly what the account holds. Fund it by transferring money into the account; you can’t assign to it. Interest that lands and is forwarded on passes straight through."
          />
        )}

        {!isIncome && (pools.length > 0 || category.poolAccountId) && (
          <Combobox
            label="Ready to assign from"
            items={[
              { value: NONE_ACCOUNT, label: 'The main Ready to assign' },
              ...pools.map((a) => ({ value: a.id, label: `${a.name}’s own` })),
            ]}
            value={poolAccountId || NONE_ACCOUNT}
            onChange={(v) => {
              if (v) setPoolAccountId(v === NONE_ACCOUNT ? '' : v);
            }}
            description="For a bill paid from that account: it is funded from the money moved there."
          />
        )}

        {!isIncome && (
          <Checkbox
            checked={keepOverspending}
            onCheckedChange={setKeepOverspending}
            description="For spending that will be paid back. An overspent month carries into the next instead of starting at zero, and Ready to assign is not reduced until you assign money to cover it or the repayment arrives."
          >
            <span className="font-medium">Keep overspending</span>
          </Checkbox>
        )}

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <SavingPausedHint className="text-right" />

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onClose();
              onDelete(category!.id);
            }}
          >
            Delete
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || !name.trim() || updateCategory.isPending}>
              {updateCategory.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

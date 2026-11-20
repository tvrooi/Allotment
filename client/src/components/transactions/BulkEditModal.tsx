import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CategorySelectButton } from './CategorySelectButton';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useCategories } from '../../hooks/useCategories';
import { useTags } from '../../hooks/useTags';
import { useFormReset } from '../../hooks/useFormReset';
import { useBulkEdit, usePreviewBulkEdit } from '../../hooks/useTransactionEdits';
import type { BulkChanges, BulkPreview, BulkSkipReason } from '../../api/transactions';
import type { CategoryGroup, TransactionQueryParams } from '../../types';

interface Props {
  params: TransactionQueryParams;
  /** Rows in the register: the count the user sees */
  count: number;
  isOpen: boolean;
  onClose: () => void;
}

type Choice<T> = { set: false } | { set: true; value: T };
const NO_CHANGE = { set: false } as const;
type TagChoice = 'add' | 'remove';

interface Draft {
  /** Set to a category, clear to uncategorized, or leave */
  category: { mode: 'keep' | 'set' | 'clear'; id: string | null };
  payee: Choice<string>;
  notes: Choice<string | null>;
  hidden: Choice<boolean>;
  reviewed: Choice<boolean>;
  tags: Record<string, TagChoice>;
}

const EMPTY: Draft = {
  category: { mode: 'keep', id: null },
  payee: NO_CHANGE,
  notes: NO_CHANGE,
  hidden: NO_CHANGE,
  reviewed: NO_CHANGE,
  tags: {},
};

const NO_GROUPS: CategoryGroup[] = [];
/** A mode list beside its field: wide enough for its longest choice, so it never jumps */
const modeCls = 'w-40';
const labelCls = 'text-xs font-medium text-text-secondary mb-1.5 block';

/** "2 reconciled transactions", "1 split transaction (change its parts instead)" */
const SKIP_TEXT: Record<BulkSkipReason, (n: number) => string> = {
  reconciled: (n) => `${n.toLocaleString()} reconciled transaction${n === 1 ? '' : 's'}`,
  transfer: (n) => `${n.toLocaleString()} transfer${n === 1 ? '' : 's'}`,
  split: (n) =>
    `${n.toLocaleString()} split transaction${n === 1 ? ' (change its parts instead)' : 's (change their parts instead)'}`,
  household: (n) =>
    `${n.toLocaleString()} transaction${n === 1 ? '' : 's'} linked to a household entry`,
};

/** The draft as the server's changes: only what the user changed */
function toChanges(d: Draft): BulkChanges {
  const c: BulkChanges = {};
  if (d.category.mode === 'clear') c.categoryId = null;
  if (d.category.mode === 'set' && d.category.id) c.categoryId = d.category.id;
  if (d.payee.set && d.payee.value.trim()) c.payeeName = d.payee.value.trim();
  if (d.notes.set) c.notes = d.notes.value === null ? null : d.notes.value.trim() || null;
  if (d.hidden.set) c.hiddenFromReports = d.hidden.value;
  if (d.reviewed.set) c.reviewed = d.reviewed.value;
  const add = Object.keys(d.tags).filter((t) => d.tags[t] === 'add');
  const remove = Object.keys(d.tags).filter((t) => d.tags[t] === 'remove');
  if (add.length) c.addTagIds = add;
  if (remove.length) c.removeTagIds = remove;
  return c;
}

/**
 * Change several fields on every transaction in the register's selection at once. Each field
 * starts at "No change"; a confirmation lists what will change, which accounts are affected
 * and which rows are left alone, and the edit can be undone.
 */
export function BulkEditModal({ params, count, isOpen, onClose }: Props) {
  const canSave = useCanSave();
  const { data: groups = NO_GROUPS } = useCategories();
  const { data: tags = [] } = useTags();
  const preview = usePreviewBulkEdit();
  const apply = useBulkEdit();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirm, setConfirm] = useState<BulkPreview | null>(null);
  useFormReset(isOpen ? 'open' : null, () => {
    setDraft(EMPTY);
    setConfirm(null);
    preview.reset();
    apply.reset();
  });

  const changes = toChanges(draft);
  const changeCount = Object.keys(changes).length;
  const categoryName = (id: string | null) =>
    id === null
      ? 'Uncategorised'
      : (groups.flatMap((g) => g.categories).find((c) => c.id === id)?.name ?? 'Category');
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? 'Tag';

  // What the confirmation lists, in the user's words
  const summary: string[] = [];
  if (changes.categoryId !== undefined)
    summary.push(`Category → ${categoryName(changes.categoryId)}`);
  if (changes.payeeName) summary.push(`Payee → ${changes.payeeName}`);
  if (changes.notes !== undefined)
    summary.push(changes.notes === null ? 'Remove notes' : `Notes → ${changes.notes}`);
  if (changes.hiddenFromReports !== undefined)
    summary.push(changes.hiddenFromReports ? 'Hide from reports' : 'Show in reports');
  if (changes.reviewed !== undefined)
    summary.push(changes.reviewed ? 'Mark reviewed' : 'Mark not reviewed');
  if (changes.addTagIds) summary.push(`Add tags: ${changes.addTagIds.map(tagName).join(', ')}`);
  if (changes.removeTagIds)
    summary.push(`Remove tags: ${changes.removeTagIds.map(tagName).join(', ')}`);

  function review() {
    preview.mutate({ params, changes }, { onSuccess: setConfirm });
  }

  function doApply() {
    if (!confirm) return;
    apply.mutate(
      { params, changes, expectedCount: confirm.matched },
      { onSuccess: onClose, onError: () => setConfirm(null) },
    );
  }

  const triState = <T,>(
    label: string,
    choice: Choice<T>,
    options: { label: string; value: T }[],
    onChange: (c: Choice<T>) => void,
  ) => (
    <div>
      <label className={labelCls} htmlFor={`bulk-${label.toLowerCase().replace(/\W+/g, '-')}`}>
        {label}
      </label>
      <Select
        id={`bulk-${label.toLowerCase().replace(/\W+/g, '-')}`}
        aria-label={label}
        value={String(choice.set ? options.findIndex((o) => o.value === choice.value) : -1)}
        onChange={(v) => {
          if (!v) return;
          const i = Number(v);
          onChange(i < 0 ? NO_CHANGE : { set: true, value: options[i].value });
        }}
        options={[
          { value: '-1', label: 'No change' },
          ...options.map((o, i) => ({ value: String(i), label: o.label })),
        ]}
      />
    </div>
  );

  const skipped = confirm
    ? (Object.keys(confirm.skipped) as BulkSkipReason[]).filter((r) => confirm.skipped[r] > 0)
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={confirm ? 'Does this look right?' : `Edit ${count.toLocaleString()} transactions`}
      size="md"
    >
      {confirm ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {confirm.changing.toLocaleString()} of {confirm.matched.toLocaleString()} transaction
            {confirm.matched === 1 ? '' : 's'} will change
            {confirm.accounts.length > 0 && ` in ${confirm.accounts.map((a) => a.name).join(', ')}`}
            :
          </p>
          <ul className="text-sm text-text space-y-1 list-disc pl-5">
            {summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <p className="text-sm text-caution">
              Category, payee and notes stay as they are on{' '}
              {skipped.map((r) => SKIP_TEXT[r](confirm.skipped[r])).join(', ')}.
            </p>
          )}
          <p className="text-xs text-text-tertiary">You can undo this afterwards.</p>
          {apply.error && (
            <p role="alert" className="text-sm text-negative">
              {apply.error.message}
            </p>
          )}
          <SavingPausedHint />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Back
            </Button>
            <Button
              onClick={doApply}
              disabled={!canSave || apply.isPending || confirm.changing === 0}
            >
              Apply to {confirm.changing.toLocaleString()}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="bulk-category">
              Category
            </label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Select
                id="bulk-category"
                aria-label="Category change"
                className={modeCls}
                value={draft.category.mode}
                onChange={(mode) => {
                  if (!mode) return;
                  setDraft((d) => ({
                    ...d,
                    category: { ...d.category, mode: mode as Draft['category']['mode'] },
                  }));
                }}
                options={[
                  { value: 'keep', label: 'No change' },
                  { value: 'set', label: 'Set to' },
                  { value: 'clear', label: 'Uncategorised' },
                ]}
              />
              {draft.category.mode === 'set' && (
                // As the list it replaces: every category, hidden ones too, and no new ones here;
                // "Uncategorised" is the mode list's own choice
                <CategorySelectButton
                  value={draft.category.id}
                  onChange={(id) => setDraft((d) => ({ ...d, category: { mode: 'set', id } }))}
                  groups={groups}
                  label="New category"
                  placeholder="Choose a category…"
                  allowNone={false}
                  allowCreate={false}
                  includeHidden
                />
              )}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="bulk-payee">
              Payee
            </label>
            <Input
              id="bulk-payee"
              placeholder="No change"
              value={draft.payee.set ? draft.payee.value : ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  payee: e.target.value ? { set: true, value: e.target.value } : NO_CHANGE,
                }))
              }
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="bulk-notes">
              Notes
            </label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Select
                id="bulk-notes"
                aria-label="Notes change"
                className={modeCls}
                value={!draft.notes.set ? 'keep' : draft.notes.value === null ? 'clear' : 'set'}
                onChange={(mode) => {
                  if (!mode) return;
                  setDraft((d) => ({
                    ...d,
                    notes:
                      mode === 'keep'
                        ? NO_CHANGE
                        : { set: true, value: mode === 'clear' ? null : '' },
                  }));
                }}
                options={[
                  { value: 'keep', label: 'No change' },
                  { value: 'set', label: 'Replace with' },
                  { value: 'clear', label: 'Remove notes' },
                ]}
              />
              {draft.notes.set && draft.notes.value !== null && (
                <Input
                  aria-label="New notes"
                  value={draft.notes.value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: { set: true, value: e.target.value } }))
                  }
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
            {triState(
              'Reports',
              draft.hidden,
              [
                { label: 'Hide from reports', value: true },
                { label: 'Show in reports', value: false },
              ],
              (hidden) => setDraft((d) => ({ ...d, hidden })),
            )}
            {triState(
              'Review',
              draft.reviewed,
              [
                { label: 'Mark reviewed', value: true },
                { label: 'Mark not reviewed', value: false },
              ],
              (reviewed) => setDraft((d) => ({ ...d, reviewed })),
            )}
          </div>

          {tags.length > 0 && (
            <div>
              <span className={labelCls}>Tags (click to add, again to remove)</span>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const state = draft.tags[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`${t.name}: ${state === 'add' ? 'add' : state === 'remove' ? 'remove' : 'no change'}`}
                      onClick={() =>
                        setDraft((d) => {
                          const next = { ...d.tags };
                          if (!state) next[t.id] = 'add';
                          else if (state === 'add') next[t.id] = 'remove';
                          else delete next[t.id];
                          return { ...d, tags: next };
                        })
                      }
                      className={`px-2.5 py-1 rounded-full text-xs border max-md:min-h-11 ${
                        state === 'add'
                          ? 'border-positive text-positive'
                          : state === 'remove'
                            ? 'border-negative text-negative line-through'
                            : 'border-border text-text-secondary'
                      }`}
                    >
                      {state === 'add' ? '+ ' : state === 'remove' ? '− ' : ''}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {preview.error && (
            <p role="alert" className="text-sm text-negative">
              {preview.error.message}
            </p>
          )}
          <SavingPausedHint />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={review} disabled={!changeCount || !canSave || preview.isPending}>
              Review changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

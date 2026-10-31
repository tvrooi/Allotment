import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useAccounts } from '../../hooks/useAccounts';
import { useTags } from '../../hooks/useTags';
import {
  amountToInput,
  formatCurrency,
  readTypedAmount,
  useAmountStyle,
  UNREADABLE_AMOUNT,
} from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { ScrollCue } from '../ui/ScrollCue';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  type DatePreset,
  type Direction,
  type FilterState,
  type Tristate,
} from '../../utils/transactionFilters';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3', label: 'Last 3 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'debit', label: 'Money out' },
  { value: 'credit', label: 'Money in' },
];

const TRISTATE: { value: Tristate; label: string }[] = [
  { value: 'all', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** A row of mutually exclusive buttons */
function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-text-secondary mb-1">{legend}</legend>
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 max-md:min-h-11 text-xs font-medium ${
              value === o.value
                ? 'bg-brand-600 text-brand-contrast'
                : 'bg-surface text-text-secondary hover:text-text'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface Props {
  state: FilterState;
  onChange: (s: FilterState) => void;
  /** All Transactions: offers to save the current filters as a view */
  onSaveView?: () => void;
  /** An account's own register: no account filter */
  fixedAccount?: boolean;
  externalMonth?: string;
  externalRange?: string;
}

const chipClass =
  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-brand-50 text-brand-700 rounded-full border border-brand-200';

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className={chipClass}>
      <span className="truncate max-w-48">{label}</span>
      <button
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="hover:text-brand-900 max-md:min-w-8 max-md:min-h-8 flex items-center justify-center"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/** A searchable list of checkboxes; nothing ticked means "any" */
function CheckList({
  label,
  options,
  selected,
  onChange,
  special,
}: {
  label: string;
  options: { id: string; name: string; group?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** A choice above the list that isn't one of the options ("Not categorised yet") */
  special?: { label: string; checked: boolean; onToggle: () => void };
}) {
  const [query, setQuery] = useState('');
  const shown = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-text-secondary mb-1">
        {label}
        {(selected.length > 0 || special?.checked) && (
          <button
            type="button"
            onClick={() => {
              if (special?.checked) special.onToggle();
              else onChange([]);
            }}
            className="ml-2 text-brand-600 hover:text-brand-700 font-normal"
          >
            Any ({special?.checked ? 1 : selected.length} chosen)
          </button>
        )}
      </legend>
      {options.length > 8 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find ${label.toLowerCase()}…`}
          aria-label={`Find ${label.toLowerCase()}`}
          className="w-full mb-1 px-2 py-1 text-xs border border-border rounded bg-surface text-text focus:border-brand-600 focus:outline-none"
        />
      )}
      <div className="max-h-40 overflow-y-auto pr-1 space-y-0.5">
        {special && (
          <label className="flex items-center gap-2 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={special.checked}
              onChange={special.onToggle}
              className="rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-text font-medium truncate">{special.label}</span>
          </label>
        )}
        {shown.map((o) => (
          <label key={o.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() =>
                onChange(
                  selected.includes(o.id)
                    ? selected.filter((id) => id !== o.id)
                    : [...selected, o.id],
                )
              }
              className="rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-text-secondary truncate">
              {o.name}
              {o.group && <span className="text-text-tertiary"> · {o.group}</span>}
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-text-tertiary py-1">None found</p>}
      </div>
    </fieldset>
  );
}

/** An amount bound typed as an amount, kept as a magnitude in minor units */
function AmountBound({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const style = useAmountStyle();
  const [raw, setRaw] = useState(value === null ? '' : amountToInput(value, style));
  // Follow the committed value (cleared by a chip, or read from a link), not every render:
  // the amount style is a new object each time
  const shown = useRef(value);
  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    setRaw(value === null ? '' : amountToInput(value, style));
  }, [value, style]);
  const read = raw.trim() === '' ? null : readTypedAmount(raw, style);
  const invalid = raw.trim() !== '' && read === null;
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-text-tertiary">{label}</span>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          if (invalid) return;
          const next = read === null ? null : Math.abs(read);
          shown.current = next;
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-invalid={invalid || undefined}
        title={invalid ? UNREADABLE_AMOUNT : undefined}
        className={`w-full px-2 py-1 text-sm border rounded bg-surface text-text tabular-nums focus:outline-none focus:border-brand-600 ${invalid ? 'border-negative' : 'border-border'}`}
      />
    </label>
  );
}

export function TransactionFilters({
  state,
  onChange,
  fixedAccount,
  externalMonth,
  externalRange,
  onSaveView,
}: Props) {
  const [rawSearch, setRawSearch] = useState(state.search);
  const [open, setOpen] = useState(false);
  const { data: groups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const { data: tags = [] } = useTags();

  useEffect(() => {
    setRawSearch(state.search);
  }, [state.search]);

  const categoryOptions = useMemo(
    () =>
      groups.flatMap((g) => g.categories.map((c) => ({ id: c.id, name: c.name, group: g.name }))),
    [groups],
  );
  const accountOptions = useMemo(
    () => accounts.filter((a) => !a.closedAt || state.accountIds.includes(a.id)),
    [accounts, state.accountIds],
  );
  const payeeOptions = useMemo(
    () => [...payees].sort((a, b) => a.name.localeCompare(b.name)),
    [payees],
  );
  const nameOf = (list: { id: string; name: string }[], id: string) =>
    list.find((x) => x.id === id)?.name ?? 'Unknown';
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });
  const count = activeFilterCount(state);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const search = e.target.value;
    setRawSearch(search);
    set({ search });
  }

  const listLabel = (names: string[]) =>
    names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  const amountLabel =
    state.minAmount !== null && state.maxAmount !== null
      ? `${formatCurrency(state.minAmount)} – ${formatCurrency(state.maxAmount)}`
      : state.minAmount !== null
        ? `${formatCurrency(state.minAmount)} or more`
        : `Up to ${formatCurrency(state.maxAmount ?? 0)}`;

  return (
    <div data-guide="transactions.filters" className="border-b border-border-light bg-surface">
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
        <div className="relative flex items-center flex-1 min-w-40">
          <Search size={14} className="absolute left-2.5 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={rawSearch}
            onChange={handleSearchChange}
            placeholder="Search payee or notes…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-full bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          {rawSearch && (
            <button
              onClick={() => {
                setRawSearch('');
                set({ search: '' });
              }}
              aria-label="Clear search"
              className="absolute right-2 text-text-tertiary hover:text-text-secondary"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex items-center gap-1.5 px-2.5 py-1 max-md:min-h-11 text-xs font-medium rounded-full border transition-colors ${
            open || count > 0
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-border text-text-secondary hover:text-text'
          }`}
        >
          <SlidersHorizontal size={12} /> Filters
          {count > 0 && <span className="tabular-nums">({count})</span>}
        </button>

        <ScrollCue
          className="border-b border-transparent max-md:max-w-full"
          scrollerClassName="flex gap-0"
        >
          {externalRange ? (
            <span className="px-2.5 py-1 text-xs text-text-secondary">{externalRange}</span>
          ) : (
            DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => set({ datePreset: p.value })}
                className={`px-2.5 py-1 max-md:min-h-11 max-md:text-sm whitespace-nowrap shrink-0 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  !externalMonth && state.datePreset === p.value
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {p.label}
              </button>
            ))
          )}
        </ScrollCue>

        {!externalRange && !externalMonth && state.datePreset === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="date"
              aria-label="From"
              value={state.from}
              max={state.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className="px-2 py-1 border border-border rounded bg-surface text-text"
            />
            <span>to</span>
            <input
              type="date"
              aria-label="To"
              value={state.to}
              min={state.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className="px-2 py-1 border border-border rounded bg-surface text-text"
            />
          </div>
        )}
      </div>

      {open && (
        <div className="px-4 pb-3 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {!fixedAccount && (
            <CheckList
              label="Accounts"
              options={accountOptions}
              selected={state.accountIds}
              onChange={(accountIds) => set({ accountIds })}
            />
          )}
          <CheckList
            label="Categories"
            options={categoryOptions}
            selected={state.categoryIds}
            onChange={(categoryIds) => set({ categoryIds, uncategorized: false })}
            special={{
              label: 'Not categorised yet',
              checked: state.uncategorized,
              onToggle: () => set({ uncategorized: !state.uncategorized, categoryIds: [] }),
            }}
          />
          <CheckList
            label="Payees"
            options={payeeOptions}
            selected={state.payeeIds}
            onChange={(payeeIds) => set({ payeeIds })}
          />
          <div className="space-y-3 min-w-0">
            <Segmented
              legend="Direction"
              options={DIRECTIONS}
              value={state.direction}
              onChange={(direction) => set({ direction })}
            />
            <fieldset>
              <legend className="text-xs font-medium text-text-secondary mb-1">
                Amount (inclusive, either direction)
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <AmountBound
                  label="At least"
                  value={state.minAmount}
                  onChange={(minAmount) =>
                    set({
                      minAmount,
                      maxAmount:
                        minAmount !== null &&
                        state.maxAmount !== null &&
                        state.maxAmount < minAmount
                          ? null
                          : state.maxAmount,
                    })
                  }
                />
                <AmountBound
                  label="At most"
                  value={state.maxAmount}
                  onChange={(maxAmount) =>
                    set({
                      maxAmount,
                      minAmount:
                        maxAmount !== null &&
                        state.minAmount !== null &&
                        state.minAmount > maxAmount
                          ? null
                          : state.minAmount,
                    })
                  }
                />
              </div>
            </fieldset>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.excludeTransfers}
                onChange={(e) => set({ excludeTransfers: e.target.checked })}
                className="rounded border-border text-brand-600 focus:ring-brand-600"
              />
              <span className="text-sm text-text-secondary">Hide transfers</span>
            </label>
          </div>
          {tags.length > 0 && (
            <CheckList
              label="Tags"
              options={tags}
              selected={state.tagIds}
              onChange={(tagIds) => set({ tagIds })}
            />
          )}
          <div className="space-y-3 min-w-0">
            <Segmented
              legend="Reviewed"
              options={TRISTATE}
              value={state.reviewed}
              onChange={(reviewed) => set({ reviewed })}
            />
            <Segmented
              legend="Hidden from reports"
              options={TRISTATE}
              value={state.hidden}
              onChange={(hidden) => set({ hidden })}
            />
          </div>
        </div>
      )}

      {count > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
          {state.search && <Chip label={`“${state.search}”`} onClear={() => set({ search: '' })} />}
          {state.budgetReport && (
            <Chip
              label="Budget accounts, no internal transfers"
              onClear={() => set({ budgetReport: false })}
            />
          )}
          {state.accountIds.length > 0 && (
            <Chip
              label={listLabel(state.accountIds.map((id) => nameOf(accounts, id)))}
              onClear={() => set({ accountIds: [] })}
            />
          )}
          {state.uncategorized && (
            <Chip label="Not categorised yet" onClear={() => set({ uncategorized: false })} />
          )}
          {state.categoryIds.length > 0 && (
            <Chip
              label={listLabel(state.categoryIds.map((id) => nameOf(categoryOptions, id)))}
              onClear={() => set({ categoryIds: [] })}
            />
          )}
          {state.categoryGroupId && (
            <Chip
              label={`Group: ${groups.find((g) => g.id === state.categoryGroupId)?.name ?? 'Unknown'}`}
              onClear={() => set({ categoryGroupId: null })}
            />
          )}
          {state.payeeIds.length > 0 && (
            <Chip
              label={listLabel(state.payeeIds.map((id) => nameOf(payees, id)))}
              onClear={() => set({ payeeIds: [] })}
            />
          )}
          {state.payeeName !== null && (
            <Chip
              label={state.payeeName ? `Payee: ${state.payeeName}` : 'No payee'}
              onClear={() => set({ payeeName: null })}
            />
          )}
          {state.direction !== 'all' && (
            <Chip
              label={state.direction === 'debit' ? 'Money out' : 'Money in'}
              onClear={() => set({ direction: 'all' })}
            />
          )}
          {(state.minAmount !== null || state.maxAmount !== null) && (
            <Chip label={amountLabel} onClear={() => set({ minAmount: null, maxAmount: null })} />
          )}
          {state.excludeTransfers && (
            <Chip label="No transfers" onClear={() => set({ excludeTransfers: false })} />
          )}
          {state.tagIds.length > 0 && (
            <Chip
              label={`Tagged ${listLabel(state.tagIds.map((id) => nameOf(tags, id)))}`}
              onClear={() => set({ tagIds: [] })}
            />
          )}
          {state.reviewed !== 'all' && (
            <Chip
              label={state.reviewed === 'yes' ? 'Reviewed' : 'Not reviewed'}
              onClear={() => set({ reviewed: 'all' })}
            />
          )}
          {state.hidden !== 'all' && (
            <Chip
              label={state.hidden === 'yes' ? 'Hidden from reports' : 'Shown in reports'}
              onClear={() => set({ hidden: 'all' })}
            />
          )}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...DEFAULT_FILTERS,
                datePreset: state.datePreset,
                from: state.from,
                to: state.to,
              })
            }
            className="text-xs text-text-tertiary hover:text-text-secondary underline-offset-2 hover:underline"
          >
            Clear all
          </button>
          {onSaveView && (
            <button
              type="button"
              onClick={onSaveView}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              Save view
            </button>
          )}
          {state.datePreset === 'custom' && (state.from || state.to) && (
            <span className="text-xs text-text-tertiary">
              {state.from ? formatDay(state.from) : 'Start'} –{' '}
              {state.to ? formatDay(state.to) : 'today'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

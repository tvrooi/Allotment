import { CardPayments } from '../components/budget/CardPayments';
import { CardRowNotes } from '../components/budget/CardRowNotes';
import { cardsByCategory, paymentCategories } from '../utils/cardRows';
import type { CardPosition } from '../api/budget';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { MoneyMoves } from '../components/budget/MoneyMoves';
import { canMoveIn, useMoveRequest } from '../store/moveRequestStore';
import { AssistantSuggestions } from '../components/budget/AssistantSuggestions';
import { useState, useRef, useMemo, useEffect, lazy, Suspense, type ElementRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Layers,
  Lightbulb,
  MoreHorizontal,
  Search,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { AssignBlockError } from '../components/budget/AssignBlockError';
import { useCategories } from '../hooks/useCategories';
import { useBudget, useBudgetSummary, useSetBudget, useSetBudgetBulk } from '../hooks/useBudget';
import { formatCurrency, UNREADABLE_AMOUNT } from '../utils/currency';
import { assignmentToInput, readAmountExpression } from '../utils/amountExpression';
import { BudgetInspector } from '../components/budget/BudgetInspector';
import { BudgetSummaryWidget } from '../components/budget/BudgetSummaryWidget';
import { BudgetEditPopover } from '../components/budget/BudgetEditPopover';
import { Button, ButtonLink } from '../components/ui/Button';
import { targetLabel } from '../utils/targets';
import { FundTargets } from '../components/budget/FundTargets';
import { AutoAssign } from '../components/budget/AutoAssign';
import { AssignMenu } from '../components/budget/AssignMenu';
import { SpentBar } from '../components/budget/SpentBar';
import { PhoneBudget } from '../components/budget/PhoneBudget';
import { PaydayPlan } from '../components/budget/PaydayPlan';
import { MissingRatesBanner } from '../components/currency/MissingRatesBanner';
import { useIsPhone } from '../hooks/useIsPhone';
import { useCanSave } from '../hooks/useConnection';
import {
  availability,
  availableTone,
  expectedFundingNote,
  captionTone,
  categoryFigures,
  splitCategories,
} from '../utils/budgetFigures';
import { TransferredNote, useLinkedAccount } from '../components/budget/TransferredNote';
import { ExpectedNote } from '../components/budget/ExpectedNote';
import type { BudgetCategory, BudgetGroup, BudgetType } from '../types';
import { RentOrOwn } from '../components/budget/RentOrOwn';
import { BudgetViewSwitch } from '../components/budget/BudgetViewSwitch';
import { GuideLink } from '../components/guide/GuideLink';
import { Tip } from '../components/guide/Tip';
import { TIPS } from '../guides';
import { useMenuKeyboard } from '../hooks/useMenuKeyboard';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { PAGE_GUTTER } from '../components/ui/pageGutter';
import { MANAGE_CATEGORIES_LINK } from '../utils/movedSections';

function AmountInput({
  cents,
  label,
  closed,
  saving,
  error,
  picked,
  onDraft,
  onSave,
  onMove,
  onCancel,
}: {
  cents: number;
  /** An amount chosen from the popover: shown in the field, so a refusal and a retry mean it */
  picked: { cents: number } | null;
  label: string;
  /** The save is on its way: the typed amount stays, locked, until the server answers */
  saving: boolean;
  /** Why the last save was refused; the typed amount stays to correct */
  error: string | null;
  /** Set once the editor has already saved or cancelled, so the blur that follows does nothing */
  closed: { current: boolean };
  /** The amount typed so far, or null while it isn't readable */
  onDraft: (c: number | null) => void;
  onSave: (c: number) => void;
  /** Arrow keys and Tab: save and open the next (1) or previous (-1) envelope. False when there
   * is none that way, and nothing was done */
  onMove: (direction: 1 | -1, c: number) => boolean;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(assignmentToInput(cents));
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (picked) {
      setRaw(assignmentToInput(picked.cents));
      setInvalid(false);
    }
  }, [picked]);
  // A refused save puts the cursor back in the field, so the amount can be corrected
  useEffect(() => {
    if (error) {
      input.current?.focus();
      input.current?.select();
    }
  }, [error]);

  // Saving is explicit; marking the editor closed first means the blur that follows Tab, or the
  // field locking, isn't taken for a click away. A refused save reopens it (commit)
  function save(amount: number) {
    closed.current = true;
    onSave(amount);
  }

  return (
    <>
      <input
        ref={input}
        autoFocus
        readOnly={saving}
        aria-busy={saving || undefined}
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setInvalid(false);
          onDraft(readAmountExpression(e.target.value));
        }}
        aria-invalid={invalid || !!error || undefined}
        aria-describedby={error ? 'planned-save-error' : undefined}
        title={invalid ? UNREADABLE_AMOUNT : undefined}
        // Select the amount so typing replaces it
        onFocus={(e) => e.target.select()}
        // Keys (BUD-05, docs/ENVELOPE-FUNDING.md "Typing assignments"): Enter saves, Escape
        // cancels, Down or Tab saves and opens the next envelope shown, Up or Shift+Tab the one
        // before. A sum (100+50) is worked out first; text that isn't one stays open to fix,
        // rather than saving 0. Only these keys save: clicking away cancels (see onBlur)
        onKeyDown={(e) => {
          if (saving) return;
          const amount = readAmountExpression(raw);
          if (e.key === 'Enter') {
            if (amount === null) setInvalid(true);
            else save(amount);
          }
          if (e.key === 'Escape') {
            closed.current = true;
            onCancel();
          }
          const direction =
            e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)
              ? 1
              : e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)
                ? -1
                : 0;
          if (!direction) return;
          if (amount === null) {
            e.preventDefault();
            setInvalid(true);
            return;
          }
          // With nowhere to go, an arrow saves and closes; Tab saves and leaves the table as usual
          if (onMove(direction, amount)) e.preventDefault();
          else save(amount);
        }}
        // Leaving the field any other way (a click elsewhere) cancels: money is never moved by
        // a stray click, and there is no undo. The window losing focus (switching tabs) isn't
        // leaving the field: the amount typed is still there on return
        onBlur={() => {
          if (closed.current || !document.hasFocus()) return;
          onCancel();
        }}
        className={`w-28 text-right tabular-nums text-sm bg-surface border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 read-only:opacity-60 ${invalid || error ? 'border-negative focus:ring-negative' : 'border-brand-500 focus:ring-brand-600'}`}
      />
      {saving && (
        <span role="status" className="block text-xs text-text-tertiary mt-0.5">
          Saving…
        </span>
      )}
      {error && (
        // The page-level alert above the table carries the full explanation and fixes
        <span id="planned-save-error" className="block max-w-56 text-xs text-negative mt-0.5">
          Not saved. {error}
        </span>
      )}
    </>
  );
}

interface CategoryRowProps {
  cat: BudgetCategory;
  isIncome: boolean;
  editingId: string | null;
  month: string;
  /** Ticked for the inspector (BUD-10); income rows have no tick */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onStartEdit: ((id: string) => void) | undefined;
  /** Resolves to why the save was refused, or null once it has been saved */
  onSave: (cents: number) => Promise<string | null>;
  onCancel: () => void;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
  /** A card's payment envelope: its position is shown under the name */
  card?: CardPosition;
}

function CategoryRow({
  cat,
  isIncome,
  editingId,
  month,
  selected = false,
  onToggleSelect,
  onStartEdit,
  onSave,
  onCancel,
  onApplyBulk,
  card,
}: CategoryRowProps) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  // Offline: amounts can't be saved, so they can't be edited (and an open editor closes)
  const canSave = useCanSave();
  const isEditing = editingId === cat.id && canSave;
  const { actual } = categoryFigures(cat, isIncome);
  const { kind, remaining, caption } = availability(cat, isIncome);
  const askToMove = useMoveRequest((s) => s.ask);
  // An envelope linked to an account holds what the account holds: a transfer moves its money
  const linked = useLinkedAccount(cat);
  const movable = !isIncome && !linked && canSave && remaining !== 0 && canMoveIn(month);
  const [draft, setDraft] = useState<number | null>(cat.budgeted);
  const closed = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ cents: number } | null>(null);
  const inFlight = useRef(false);
  const rowRef = useRef<HTMLTableRowElement>(null);
  // However the editor opened (a click here, or the keyboard from the row next to it), it
  // starts from this envelope's amount with nothing left over from an earlier edit
  useEffect(() => {
    if (!isEditing) return;
    closed.current = false;
    setFailure(null);
    setPicked(null);
    setDraft(cat.budgeted);
    // Only on opening: a refetch while it's open mustn't reset what is being typed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);
  // The editor closes only once the server has saved: a refused amount stays in the field, with
  // the reason, and a second Enter while the first is on its way sends nothing. True once saved
  async function commit(cents: number): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    const refused = await onSave(cents);
    inFlight.current = false;
    setSaving(false);
    if (refused !== null) {
      closed.current = false;
      setFailure(refused);
    }
    return refused === null;
  }
  // The envelope above or below as the table shows it: collapsed sections, inactive rows and
  // the filter's misses aren't on the page, so the keyboard skips them
  function neighbour(direction: 1 | -1): string | null {
    const row = rowRef.current;
    const rows = [...(row?.closest('tbody')?.querySelectorAll('tr[data-budget-row]') ?? [])];
    const at = row ? rows.indexOf(row) : -1;
    if (at < 0) return null;
    return (rows[at + direction] as HTMLElement | undefined)?.dataset.budgetRow ?? null;
  }
  function move(direction: 1 | -1, cents: number): boolean {
    const next = neighbour(direction);
    if (!next) return false;
    closed.current = true;
    // An amount left as it was isn't saved again (no undo step for nothing)
    if (cents === cat.budgeted) {
      onStartEdit?.(next);
      return true;
    }
    void commit(cents).then((saved) => {
      if (saved) onStartEdit?.(next);
    });
    return true;
  }
  // A quick amount saves straight away
  function pick(cents: number) {
    closed.current = true;
    setDraft(cents);
    setPicked({ cents });
    void commit(cents);
  }
  const quickAmounts = isIncome
    ? []
    : [
        ...(remaining < 0
          ? [
              {
                label: `Cover ${formatCurrency(-remaining)} overspent`,
                cents: cat.budgeted - remaining,
              },
            ]
          : []),
        ...(cat.target && cat.target.underfunded > 0
          ? [
              {
                label: `Fund target (+${formatCurrency(cat.target.underfunded)})`,
                cents: cat.budgeted + cat.target.underfunded,
              },
            ]
          : []),
      ];

  // Available is the column to read. A pill marks only what needs a decision (overspent, short
  // of a target); an envelope that is fine is a plain figure, and $0 is grey
  const remainingClass = `rounded-full px-2.5 py-0.5 ${availableTone(kind, remaining, !isIncome && expectedFundingNote(cat, format(new Date(), 'yyyy-MM-dd')).overdue)}`;

  return (
    <tr
      ref={rowRef}
      data-budget-row={cat.id}
      className={`border-b border-border-light ${selected ? 'bg-brand-50' : ''}`}
    >
      {/* Every row is two lines tall (h-14 is a floor): the figures, then a quiet line under
          them for the bar, the expected debit and the notes, so rows keep one rhythm */}
      <td className="relative h-14 py-1.5 pl-10 pr-3 align-top">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(cat.id)}
            aria-label={`Select ${cat.name}`}
            className="absolute left-4 top-3 h-3.5 w-3.5 accent-brand-600"
          />
        )}
        <div className="flex w-[90%] flex-wrap items-baseline justify-between gap-x-3 py-0.5 text-sm text-text">
          <span className="min-w-0">
            {showCategoryIcons && (
              <CategoryIcon icon={cat.icon} size={14} className="mr-1.5 inline" />
            )}
            {/* The name opens the envelope, as its Activity figure does */}
            <Link
              to={`/budget/category/${cat.id}`}
              aria-label={`Open ${cat.name}`}
              className="rounded-sm hover:text-brand-600 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
            >
              {cat.name}
            </Link>
          </span>
          <ExpectedNote
            cat={cat}
            onAssign={canSave && !linked && onStartEdit ? () => onStartEdit(cat.id) : undefined}
          />
        </div>
        <SpentBar cat={cat} isIncome={isIncome} />
        <TransferredNote cat={cat} className="mt-0.5" />
        {card && <CardRowNotes card={card} className="mt-0.5" />}
        {cat.target && (
          <p
            className={`text-xs mt-0.5 ${cat.target.underfunded ? 'text-caution' : 'text-text-tertiary'}`}
          >
            {targetLabel(cat.target, linked?.name)}
          </p>
        )}
      </td>
      <td className="h-14 py-1.5 px-3 text-right align-top">
        <div className="relative inline-block">
          {linked && !isIncome ? (
            <span
              className="inline-block tabular-nums text-sm px-2 py-0.5 min-w-[5.5rem] text-right text-text-secondary"
              title={`${cat.name} follows ${linked.name}. Transfer money to or from ${linked.name} to change it.`}
              aria-label={`Moved to ${linked.name} for ${cat.name}: ${formatCurrency(cat.budgeted + (cat.transferred ?? 0))}`}
            >
              {formatCurrency(cat.budgeted + (cat.transferred ?? 0))}
            </span>
          ) : isEditing ? (
            <>
              <AmountInput
                cents={cat.budgeted}
                label={isIncome ? `Expected from ${cat.name}` : `Assigned to ${cat.name}`}
                closed={closed}
                saving={saving}
                error={failure}
                picked={picked}
                onDraft={setDraft}
                onSave={(c) => void commit(c)}
                onMove={move}
                onCancel={onCancel}
              />
              {!saving && !failure && (
                <BudgetEditPopover
                  categoryId={cat.id}
                  isIncome={isIncome}
                  currentAmount={cat.budgeted}
                  draftAmount={draft}
                  quickAmounts={quickAmounts}
                  month={month}
                  onPick={pick}
                  onApplyBulk={(cents, expected) => onApplyBulk(cat.id, cents, expected)}
                />
              )}
            </>
          ) : (
            <button
              onClick={() => onStartEdit?.(cat.id)}
              disabled={!canSave}
              title={canSave ? undefined : 'Saving is paused until Allotment reconnects'}
              aria-label={`${isIncome ? 'Expected from' : 'Assigned to'} ${cat.name}: ${formatCurrency(cat.budgeted)}`}
              // Plain text until pointed at or focused: a column of empty boxes says nothing
              className="tabular-nums text-sm rounded px-2 py-0.5 min-w-[5.5rem] text-right border border-transparent bg-transparent transition-colors hover:border-border hover:bg-surface focus-visible:border-brand-500 focus-visible:bg-surface cursor-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={cat.budgeted ? 'text-text' : 'text-text-tertiary'}>
                {formatCurrency(cat.budgeted)}
              </span>
            </button>
          )}
        </div>
      </td>
      <td className="h-14 py-1.5 px-3 align-top">
        <div className="text-right">
          <Link
            to={`/budget/category/${cat.id}`}
            // The figure alone ("$0") says nothing to a screen reader
            aria-label={`${isIncome ? 'Received for' : 'Activity in'} ${cat.name}: ${formatCurrency(actual)}`}
            className="inline-block py-0.5 tabular-nums text-sm text-text-secondary hover:text-brand-600 cursor-pointer transition-colors"
          >
            {formatCurrency(actual)}
          </Link>
        </div>
      </td>
      <td className="h-14 py-1.5 pl-3 pr-6 text-right align-top">
        {movable ? (
          // Clicking the figure opens Move money with this envelope filled in (BUD-06)
          <button
            type="button"
            onClick={() => askToMove(cat.id, remaining)}
            aria-label={
              remaining < 0
                ? `Cover ${cat.name}: ${formatCurrency(-remaining)} overspent`
                : `Move money from ${cat.name}: ${formatCurrency(remaining)} available`
            }
            title={remaining < 0 ? 'Cover this overspending' : 'Move money out of this envelope'}
            className={`tabular-nums text-sm inline-block cursor-pointer hover:ring-1 hover:ring-border focus-visible:ring-2 focus-visible:ring-brand-500 ${remainingClass}`}
          >
            {formatCurrency(remaining)}
          </button>
        ) : (
          <span className={`tabular-nums text-sm inline-block ${remainingClass}`}>
            {formatCurrency(remaining)}
          </span>
        )}
        {caption && !(kind === 'uncovered' && cat.expectedItems?.length) && (
          // Bill shortfalls already have a dated funding note above the bar.
          // One line so rows keep their rhythm; the full wording is on hover
          <span title={caption} className={`block truncate text-xs mt-0.5 ${captionTone(kind)}`}>
            {caption}
          </span>
        )}
      </td>
    </tr>
  );
}

interface IncomeGroupProps {
  group: BudgetGroup;
  editingId: string | null;
  month: string;
  onStartEdit: ((id: string) => void) | undefined;
  onSave: (categoryId: string, cents: number) => Promise<string | null>;
  onCancel: () => void;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
  /** Nothing is planned this month yet: list every category, so there's something to plan */
  showAll: boolean;
}

function IncomeGroupSection({
  group,
  editingId,
  month,
  onStartEdit,
  onSave,
  onCancel,
  onApplyBulk,
  showAll,
}: IncomeGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  const totals = useMemo(() => {
    const raw = group.categories.reduce(
      (acc, c) => ({
        budgeted: acc.budgeted + c.budgeted,
        spent: acc.spent + categoryFigures(c, false).actual,
        balance: acc.balance + c.balance,
        carryOver: acc.carryOver + c.carryOver,
      }),
      { budgeted: 0, spent: 0, balance: 0, carryOver: 0 },
    );
    return { ...raw, received: raw.balance - raw.carryOver - raw.budgeted };
  }, [group.categories]);

  const { shown, hidden: inactive } = splitCategories(group.categories, true);
  const visibleCats = showUnbudgeted || showAll ? group.categories : shown;

  return (
    <>
      <tr className="h-2" aria-hidden>
        <td colSpan={4} />
      </tr>
      <tr
        className="bg-surface border-y border-border-light cursor-pointer select-none hover:bg-hover transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <td className="py-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary shrink-0">
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="text-sm font-bold text-text">{group.name}</span>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
          {formatCurrency(totals.budgeted)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
          {formatCurrency(totals.received)}
        </td>
        <td
          className={`py-2 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${Math.max(totals.budgeted - totals.received, 0) > 0 ? 'text-positive' : 'text-text-tertiary'}`}
        >
          {formatCurrency(Math.max(totals.budgeted - totals.received, 0))}
        </td>
      </tr>
      {!collapsed && (
        <>
          {visibleCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              isIncome
              editingId={editingId}
              month={month}
              onStartEdit={onStartEdit}
              onSave={(cents) => onSave(cat.id, cents)}
              onCancel={onCancel}
              onApplyBulk={onApplyBulk}
            />
          ))}
          {inactive.length > 0 && !showAll && (
            <tr className="border-b border-border-light">
              <td colSpan={4} className="py-2 pl-10 pr-3">
                <button
                  onClick={() => setShowUnbudgeted((s) => !s)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  <Eye size={12} />
                  {showUnbudgeted ? 'Hide' : 'Show'} {inactive.length} inactive{' '}
                  {inactive.length === 1 ? 'category' : 'categories'}
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

interface BudgetTypeSectionProps {
  label: string;
  categories: BudgetCategory[];
  editingId: string | null;
  month: string;
  onStartEdit: ((id: string) => void) | undefined;
  onSave: (categoryId: string, cents: number) => Promise<string | null>;
  onCancel: () => void;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
  showAll: boolean;
  /** Card positions by payment envelope, for the Card payments section */
  cards?: Map<string, CardPosition>;
  /** Ticks for the inspector; the Card payments section has none (BUD-10 covers envelopes) */
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
}

function BudgetTypeSection({
  label,
  categories,
  editingId,
  month,
  onStartEdit,
  onSave,
  onCancel,
  onApplyBulk,
  showAll,
  cards,
  selectedIds,
  onToggleSelect,
}: BudgetTypeSectionProps) {
  // Once something's planned, a section with no money in it at all starts collapsed
  const [collapsed, setCollapsed] = useState(
    () =>
      !showAll &&
      categories.length > 0 &&
      categories.every((c) => !c.budgeted && !c.balance && !c.spent && !c.carryOver),
  );
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  const totals = useMemo(
    () =>
      categories.reduce(
        (acc, c) => ({
          budgeted: acc.budgeted + c.budgeted,
          spent: acc.spent + categoryFigures(c, false).actual,
          balance: acc.balance + c.balance,
        }),
        { budgeted: 0, spent: 0, balance: 0 },
      ),
    [categories],
  );

  const { shown, hidden: inactive } = splitCategories(categories, false);
  const visibleCats = showUnbudgeted || showAll ? categories : shown;

  const status = totals.balance < 0 ? 'over' : 'healthy';
  const remaining = totals.balance;
  const remainingColor = status === 'over' ? 'text-negative' : 'text-positive';

  return (
    <>
      <tr className="h-2" aria-hidden>
        <td colSpan={4} />
      </tr>
      <tr
        className="bg-surface border-y border-border-light cursor-pointer select-none hover:bg-hover transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <td className="py-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary shrink-0">
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="text-sm font-bold text-text">{label}</span>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
          {formatCurrency(totals.budgeted)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
          {formatCurrency(totals.spent)}
        </td>
        <td
          className={`py-2 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${remainingColor}`}
        >
          {formatCurrency(remaining)}
        </td>
      </tr>

      {!collapsed && (
        <>
          {visibleCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              isIncome={false}
              editingId={editingId}
              month={month}
              selected={selectedIds?.has(cat.id) ?? false}
              onToggleSelect={onToggleSelect}
              onStartEdit={onStartEdit}
              onSave={(cents) => onSave(cat.id, cents)}
              onCancel={onCancel}
              onApplyBulk={onApplyBulk}
              card={cards?.get(cat.id)}
            />
          ))}

          {inactive.length > 0 && !showAll && (
            <tr className="border-b border-border-light">
              <td colSpan={4} className="py-2 pl-10 pr-3">
                <button
                  onClick={() => setShowUnbudgeted((s) => !s)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  <Eye size={12} />
                  {showUnbudgeted ? 'Hide' : 'Show'} {inactive.length} inactive{' '}
                  {inactive.length === 1 ? 'category' : 'categories'}
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

// Category management lives on the Budget page (#244), loaded when it is opened, as the
// Settings tab it replaced was
const CategoryManager = lazy(() =>
  import('../components/settings/CategoryManager').then((m) => ({ default: m.CategoryManager })),
);

const BUDGET_TYPES: { key: BudgetType; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'flexible', label: 'Flexible' },
  { key: 'non_monthly', label: 'Non-monthly' },
  { key: 'savings', label: 'Savings/Investments' },
];

/** A section's column labels stay pinned to the top of the scrolling table while the section is in
 * view. Sticky goes on the cells (a collapsed-border <tr> can't carry it), so the band paints its own
 * background and bottom rule; the Expenses band is later in the table, so it covers Income's. */
const BAND =
  'sticky top-0 z-10 bg-surface-alt group-hover:bg-hover transition-colors shadow-[0_1px_0_var(--color-border),0_-1px_0_var(--color-border)]';

export default function BudgetPage() {
  // Back and Forward return to where this list was (#245)
  const scrollMemory = useScrollMemory('budget');
  const [paydayView, setPaydayView] = useState(false);
  // ?view=categories: the category manager in place of the envelopes, so Back returns to it
  const [searchParams] = useSearchParams();
  const manageCategories = searchParams.get('view') === 'categories';
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Envelopes ticked for the inspector (BUD-10). Ticking changes no money
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  // The ticks are hidden until asked for; leaving select mode clears them
  const [selectMode, setSelectMode] = useState(false);
  const toggleSelectMode = () => {
    if (selectMode) setSelectedIds(new Set());
    setSelectMode(!selectMode);
  };
  const toggleSelected = (id: string) =>
    setSelectedIds((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuKeyboard({
    open: menuOpen,
    menuRef,
    buttonRef: menuButtonRef,
    onClose: () => setMenuOpen(false),
    // Its backdrop takes a tap outside, so the tap closes the menu without pressing what's below
    closeOnOutsidePress: false,
  });
  const autoAssignRef = useRef<ElementRef<typeof AutoAssign>>(null);
  const fundTargetsRef = useRef<ElementRef<typeof FundTargets>>(null);
  const canSaveBudget = useCanSave();
  const { data: categoryGroups = [] } = useCategories();
  const [putRestNote, setPutRestNote] = useState<string | null>(null);

  const { data: groups = [], isPlaceholderData: switchingMonth } = useBudget(selectedMonth);
  const { data: summary, isPlaceholderData: switchingSummary } = useBudgetSummary(selectedMonth);
  const setBudgetMutation = useSetBudget();
  const setBulkMutation = useSetBudgetBulk();
  const isPhone = useIsPhone();
  // On a phone the filter hides the sidebar that holds Move money, so a row asking for it
  // ends the filter; the panel then shows
  const moveRequested = useMoveRequest((s) => s.request !== null);
  useEffect(() => {
    if (moveRequested && isPhone) setQuery('');
  }, [moveRequested, isPhone]);

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);

  const incomeGroups = useMemo(() => groups.filter((g) => g.isIncome), [groups]);
  const allExpenseCats = useMemo(
    () =>
      groups
        .filter((g) => !g.isIncome)
        .flatMap((g) => g.categories)
        .filter((c) => !c.paymentAccountId),
    [groups],
  );

  const expensesByType = useMemo(
    () =>
      BUDGET_TYPES.map((t) => ({
        ...t,
        categories: allExpenseCats.filter((c) => c.budgetType === t.key),
      })).filter((bt) => bt.categories.length > 0),
    [allExpenseCats],
  );

  // A card's payment envelope sits beside the envelopes it reserves cash from (BUD-09). It is
  // not a spending category, so it stays out of the expense totals above.
  const cardCategories = useMemo(
    () => paymentCategories(groups.filter((g) => !g.isIncome).flatMap((g) => g.categories)),
    [groups],
  );
  const cardPositions = useMemo(() => cardsByCategory(summary?.cards), [summary?.cards]);

  // The jump field narrows the list to matching categories (inactive ones included)
  const needle = query.trim().toLowerCase();
  const matches = (c: BudgetCategory) => c.name.toLowerCase().includes(needle);
  const shownCardCategories = useMemo(
    () => (needle ? cardCategories.filter(matches) : cardCategories),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` only reads `needle`
    [cardCategories, needle],
  );
  const shownIncomeGroups = useMemo(
    () =>
      needle
        ? incomeGroups
            .map((g) => ({ ...g, categories: g.categories.filter(matches) }))
            .filter((g) => g.categories.length > 0)
        : incomeGroups,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incomeGroups, needle],
  );
  const shownExpensesByType = useMemo(
    () =>
      needle
        ? expensesByType
            .map((bt) => ({ ...bt, categories: bt.categories.filter(matches) }))
            .filter((bt) => bt.categories.length > 0)
        : expensesByType,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expensesByType, needle],
  );

  const incomeTotals = useMemo(() => {
    const cats = incomeGroups.flatMap((g) => g.categories);
    return {
      budgeted: cats.reduce((s, c) => s + c.budgeted, 0),
      received: cats.reduce((s, c) => s + (c.balance - c.carryOver - c.budgeted), 0),
    };
  }, [incomeGroups]);

  const expenseTotals = useMemo(
    () => ({
      budgeted: allExpenseCats.reduce((s, c) => s + c.budgeted, 0),
      spent: allExpenseCats.reduce((s, c) => s + categoryFigures(c, false).actual, 0),
      balance: allExpenseCats.reduce((s, c) => s + c.balance, 0),
    }),
    [allExpenseCats],
  );

  const savingsTotals = useMemo(() => {
    const cats = allExpenseCats.filter((c) => c.budgetType === 'savings');
    return {
      budgeted: cats.reduce((s, c) => s + c.budgeted, 0),
      spent: cats.reduce((s, c) => s + c.spent, 0),
    };
  }, [allExpenseCats]);

  const expensesByBudgetType = useMemo(() => {
    const calc = (type: string) => {
      const cats = allExpenseCats.filter((c) => c.budgetType === type);
      return {
        planned: cats.reduce((s, c) => s + c.budgeted, 0),
        spent: cats.reduce((s, c) => s + c.spent, 0),
      };
    };
    return { fixed: calc('fixed'), flexible: calc('flexible'), nonMonthly: calc('non_monthly') };
  }, [allExpenseCats]);

  // An editor open on one month never saves into another: close it when the month changes, and
  // ignore saves while the rows on screen are still the previous month's
  const [editingMonth, setEditingMonth] = useState(selectedMonth);
  if (editingMonth !== selectedMonth) {
    setEditingMonth(selectedMonth);
    setEditingId(null);
    setPutRestNote(null);
  }
  const monthRef = useRef(selectedMonth);
  monthRef.current = selectedMonth;
  // Resolves to why the amount was refused, or null once the server has saved it. The editor
  // closes only on success, so a refused amount is still there to correct.
  async function handleSave(categoryId: string, budgeted: number): Promise<string | null> {
    if (switchingMonth) return 'This month is still loading. Try again in a moment.';
    const month = selectedMonth;
    try {
      await setBudgetMutation.mutateAsync({ month, categoryId, budgeted });
      // Close only the editor this save came from: another opened while it was on its way, or in
      // another month, keeps what is typed in it
      if (monthRef.current === month) setEditingId((now) => (now === categoryId ? null : now));
      return null;
    } catch (e) {
      return e instanceof Error && e.message ? e.message : 'Could not save. Try again.';
    }
  }

  function handleApplyBulk(categoryId: string, budgeted: number, expected: Record<string, number>) {
    setBulkMutation.mutate({ categoryId, budgeted, fromMonth: selectedMonth, expected });
  }

  function goToToday() {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }

  const nothingPlanned =
    groups.length > 0 && !groups.some((g) => g.categories.some((c) => c.budgeted !== 0));
  // A brand-new budget lists every category until the first assignment has been made
  const brandNew = summary?.anythingAssigned === false;
  const showEvery = nothingPlanned || brandNew || !!needle;
  const beforeStart = !!summary?.budgetStartMonth && selectedMonth < summary.budgetStartMonth;
  const underfundedCount = groups
    .flatMap((g) => g.categories)
    .filter((c) => c.target?.underfunded && !c.linkedAccountId).length;
  const tbb = summary?.toBeBudgeted ?? 0;
  const expRemaining = expenseTotals.balance;
  const expBalColor =
    expRemaining > 0 ? 'text-positive' : expRemaining < 0 ? 'text-negative' : 'text-text-tertiary';

  if (manageCategories)
    return (
      <div className="flex flex-col h-full bg-surface text-text">
        <div
          className={`py-4 border-b border-border flex flex-wrap items-center justify-between gap-3 ${PAGE_GUTTER}`}
        >
          <h1 className="font-display text-title max-md:text-2xl tracking-tight">Categories</h1>
          <ButtonLink variant="secondary" size="sm" to="/budget">
            <ChevronLeft size={14} aria-hidden /> Back to budget
          </ButtonLink>
        </div>
        <div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
          <div className="max-w-2xl">
            <Suspense
              fallback={
                <p role="status" className="text-sm text-text-tertiary">
                  Loading…
                </p>
              }
            >
              <CategoryManager />
            </Suspense>
          </div>
        </div>
      </div>
    );

  if (paydayView)
    return (
      <div className="flex flex-col h-full bg-surface text-text">
        <div
          className={`py-4 border-b border-border flex flex-wrap items-center gap-3 ${PAGE_GUTTER}`}
        >
          <h1 className="font-display text-title max-md:text-2xl tracking-tight">
            Until next payday
          </h1>
          <BudgetViewSwitch
            current="payday"
            year={selectedMonth.slice(0, 4)}
            onMonth={() => setPaydayView(false)}
            onPayday={() => setPaydayView(true)}
          />
        </div>
        <div ref={scrollMemory} className="flex-1 overflow-y-auto">
          <PaydayPlan />
        </div>
      </div>
    );

  // Ready to assign, Put it in an envelope…, Hold and how it's worked out
  const summaryPanel = (
    <>
      <BudgetSummaryWidget
        funding={summary}
        toBeBudgeted={tbb}
        incomePlanned={incomeTotals.budgeted}
        incomeEarned={incomeTotals.received}
        savingsPlanned={savingsTotals.budgeted}
        savingsContributed={savingsTotals.spent}
        fixedExpenses={expensesByBudgetType.fixed}
        flexibleExpenses={expensesByBudgetType.flexible}
        nonMonthlyExpenses={expensesByBudgetType.nonMonthly}
        fundTargets={{
          count: underfundedCount,
          disabled: !canSaveBudget || switchingMonth,
          onOpen: () => fundTargetsRef.current?.open(),
        }}
        canHold={!beforeStart && selectedMonth === format(new Date(), 'yyyy-MM')}
        putRest={
          beforeStart
            ? undefined
            : {
                groups: categoryGroups.filter((g) => !g.isIncome),
                disabled: !canSaveBudget || switchingMonth,
                onPick: (categoryId, categoryName) => {
                  const cat = allExpenseCats.find((c) => c.id === categoryId);
                  // Everything left goes on top of what the category already has
                  handleSave(categoryId, (cat?.budgeted ?? 0) + tbb);
                  setPutRestNote(`Put ${formatCurrency(tbb)} in ${categoryName}.`);
                },
              }
        }
      />
      {putRestNote && !(setBudgetMutation.error || setBulkMutation.error) && (
        <p role="status" className="mt-2 text-xs text-text-secondary text-center">
          {putRestNote}
        </p>
      )}
    </>
  );
  // The month's inspector, card payments and money moves
  const sideExtras = (
    <>
      <div>
        <BudgetInspector
          month={selectedMonth}
          categories={allExpenseCats}
          selectedIds={selectedIds}
          onClear={() => setSelectedIds(new Set())}
          onFundSelected={(ids) => fundTargetsRef.current?.open(ids)}
        />
      </div>
      <div>
        <CardPayments
          key={`cards:${selectedMonth}`}
          month={selectedMonth}
          summary={summary}
          loading={switchingMonth || switchingSummary}
        />
        <MoneyMoves
          key={selectedMonth}
          month={selectedMonth}
          categories={groups.filter((g) => !g.isIncome).flatMap((g) => g.categories)}
        />
      </div>
    </>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-surface">
        <div
          data-testid="budget-header"
          className={`py-4 max-md:py-3 border-b border-border shrink-0 ${PAGE_GUTTER}`}
        >
          <div className="flex flex-wrap gap-3 max-md:gap-2 items-center justify-between">
            <div className="flex items-center gap-1">
              <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
                <span className="sr-only">Budget, </span>
                <span>{format(monthDate, 'MMMM yyyy')}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isPhone && (
                <>
                  <BudgetViewSwitch
                    current="month"
                    year={selectedMonth.slice(0, 4)}
                    onMonth={() => setPaydayView(false)}
                    onPayday={() => setPaydayView(true)}
                  />
                  <AssignMenu
                    disabled={!canSaveBudget}
                    underfundedCount={underfundedCount}
                    onAutoAssign={() => autoAssignRef.current?.open()}
                    onFundTargets={() => fundTargetsRef.current?.open()}
                  />
                </>
              )}
              <AutoAssign ref={autoAssignRef} month={selectedMonth} hideButton />
              <FundTargets ref={fundTargetsRef} month={selectedMonth} groups={groups} hideButton />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
                aria-label="Previous month"
                className="w-8 px-0 max-md:w-11"
              >
                <ChevronLeft size={16} className="shrink-0" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
                aria-label="Next month"
                className="w-8 px-0 max-md:w-11"
              >
                <ChevronRight size={16} className="shrink-0" />
              </Button>
              <Button variant="secondary" size="sm" onClick={goToToday}>
                Today
              </Button>
              {isPhone && (
                <div className="relative">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="More budget actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="min-w-11 min-h-11 flex items-center justify-center rounded-md border border-border bg-surface-alt text-text-secondary"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                      <div
                        ref={menuRef}
                        role="menu"
                        aria-label="More budget actions"
                        className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-border bg-surface shadow-lg py-1"
                      >
                        <Link
                          role="menuitem"
                          to={`/budget/year/${selectedMonth.slice(0, 4)}`}
                          className="flex items-center min-h-11 px-4 text-sm text-text hover:bg-hover"
                        >
                          Year
                        </Link>
                        <Link
                          role="menuitem"
                          to={MANAGE_CATEGORIES_LINK}
                          className="flex items-center min-h-11 px-4 text-sm text-text hover:bg-hover"
                        >
                          Manage categories
                        </Link>
                        <button
                          role="menuitem"
                          disabled={!canSaveBudget}
                          onClick={() => {
                            setMenuOpen(false);
                            autoAssignRef.current?.open();
                          }}
                          className="flex w-full items-center min-h-11 px-4 text-sm text-text hover:bg-hover disabled:opacity-50"
                        >
                          Auto-assign
                        </button>
                        {underfundedCount > 0 && (
                          <button
                            role="menuitem"
                            disabled={!canSaveBudget}
                            onClick={() => {
                              setMenuOpen(false);
                              fundTargetsRef.current?.open();
                            }}
                            className="flex w-full items-center min-h-11 px-4 text-sm text-text hover:bg-hover disabled:opacity-50"
                          >
                            Fund targets ({underfundedCount})
                          </button>
                        )}
                        <button
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            setPaydayView(true);
                          }}
                          className="flex w-full items-center min-h-11 px-4 text-sm text-text hover:bg-hover"
                        >
                          Until next payday
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 max-md:mt-2 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm max-md:max-w-none">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a category"
                aria-label="Find a category"
                className="w-full text-sm border border-border rounded-lg pl-8 pr-8 py-1.5 max-md:min-h-11 bg-surface text-text placeholder:text-text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear category search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-8 min-h-8 flex items-center justify-center text-text-tertiary hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Adding, renaming, ordering and hiding categories (#244, formerly a Settings tab) */}
            {!isPhone && (
              <ButtonLink variant="ghost" size="sm" to={MANAGE_CATEGORIES_LINK}>
                <Layers size={14} aria-hidden /> Manage categories
              </ButtonLink>
            )}
          </div>
        </div>

        {!nothingPlanned && !beforeStart && (
          <Tip
            tip={TIPS.budgetCarry}
            className={`py-3 border-b border-border-light shrink-0 ${PAGE_GUTTER}`}
          />
        )}
        {nothingPlanned && !beforeStart && !(isPhone && needle) && (
          <div
            className={`flex items-start gap-3 py-3 bg-brand-50 border-b border-border-light text-sm text-text-secondary shrink-0 ${PAGE_GUTTER}`}
          >
            <Lightbulb size={16} className="text-brand-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p>
                No money assigned for {format(monthDate, 'MMMM')} yet. {isPhone ? 'Tap' : 'Click'}{' '}
                an amount to give money you already have a job.
              </p>
              {!isPhone && (
                <details className="mt-1">
                  <summary className="cursor-pointer w-fit font-medium text-brand-600 hover:text-brand-700">
                    How this works
                  </summary>
                  <p className="mt-1">
                    Pay you’ve received is ready to assign straight away; the amounts beside income
                    are only what you expect. What’s left in an envelope carries into next month.
                    Envelopes you leave empty are tucked away once you’ve planned something.{' '}
                    <GuideLink
                      page="budgeting"
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Read the guide
                    </GuideLink>
                  </p>
                </details>
              )}
              <RentOrOwn />
            </div>
          </div>
        )}

        {(setBudgetMutation.error || setBulkMutation.error) && (
          <AssignBlockError
            error={(setBudgetMutation.error || setBulkMutation.error)!}
            onResolved={() => {
              setBudgetMutation.reset();
              setBulkMutation.reset();
            }}
          />
        )}
        <MissingRatesBanner className="mx-6 mt-3 shrink-0" />
        <AssistantSuggestions />
        {beforeStart && (
          <p role="status" className="mx-6 max-md:mx-4 mt-3 shrink-0 text-sm text-text-secondary">
            This month is before your budget start. Activity is what you really spent, shown for
            reference: nothing is assigned or carried, and it can't be edited. Its transactions are
            also in your accounts and reports.{' '}
            <Link to="/settings?tab=budget" className="text-brand-700 underline">
              Budget start
            </Link>
          </p>
        )}

        {/* While the next month loads, the previous one stays (faded) so nothing jumps */}
        <div
          ref={scrollMemory}
          aria-busy={switchingMonth}
          inert={switchingMonth}
          className={`flex max-md:flex-col flex-1 overflow-y-auto transition-opacity ${switchingMonth ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {/* Phones (UX audit AU-002): a compact Ready to assign, then the envelopes, then the
            month's inspector, card payments and moves; searching shows only the envelopes */}
          {isPhone && !needle && <div className="px-4 pt-3">{summaryPanel}</div>}
          <div
            data-guide="budget.categories"
            className="flex-1 max-md:flex-none max-md:overflow-x-auto"
          >
            {isPhone ? (
              <PhoneBudget
                // The envelopes you assign to first (UX audit AU-002); expected income after them
                sections={[
                  ...shownExpensesByType.map((bt) => ({
                    key: bt.key,
                    label: bt.label,
                    isIncome: false,
                    categories: bt.categories,
                  })),
                  ...(shownCardCategories.length
                    ? [
                        {
                          key: 'card-payments',
                          label: 'Card payments',
                          isIncome: false,
                          categories: shownCardCategories,
                          always: true,
                        },
                      ]
                    : []),
                  ...shownIncomeGroups.map((g) => ({
                    key: g.id,
                    label: g.name,
                    isIncome: true,
                    categories: g.categories,
                  })),
                ]}
                cards={cardPositions}
                month={selectedMonth}
                onSave={handleSave}
                onApplyBulk={handleApplyBulk}
                showAll={showEvery}
                readOnly={beforeStart}
              />
            ) : (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col />
                  <col style={{ width: '6.75rem' }} />
                  {/* Activity holds "-$1,150 expected" on one line, so rows stay one height */}
                  <col style={{ width: '8rem' }} />
                  <col style={{ width: '6.75rem' }} />
                </colgroup>
                <tbody>
                  {/* Income section header */}
                  <tr
                    className="group cursor-pointer select-none"
                    onClick={() => setIncomeCollapsed((c) => !c)}
                  >
                    <td className={`${BAND} py-2 px-4`}>
                      <div className="flex items-center gap-2">
                        <span className="text-text-tertiary shrink-0">
                          {incomeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </span>
                        <span className="text-xs font-semibold text-text-secondary">Income</span>
                      </div>
                    </td>
                    <td
                      className={`${BAND} py-2 px-3 text-right text-xs font-semibold text-text-tertiary`}
                      title="What you expect to earn. It's a plan, not money: only income you've received is ready to assign."
                    >
                      Expected
                    </td>
                    <td
                      className={`${BAND} py-2 px-3 text-right text-xs font-semibold text-text-tertiary`}
                    >
                      Received
                    </td>
                    <td className={`${BAND} py-2 pl-3 pr-6 text-right text-xs font-bold text-text`}>
                      Still to come
                    </td>
                  </tr>

                  {!incomeCollapsed && (
                    <>
                      {shownIncomeGroups.map((group) => (
                        <IncomeGroupSection
                          key={group.id}
                          group={group}
                          editingId={editingId}
                          month={selectedMonth}
                          onStartEdit={beforeStart ? undefined : setEditingId}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          onApplyBulk={handleApplyBulk}
                          showAll={showEvery}
                        />
                      ))}

                      {/* Total Income row */}
                      <tr className="bg-surface border-y border-border">
                        <td className="py-2 px-4 text-sm font-bold text-text">Total income</td>
                        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                          {formatCurrency(incomeTotals.budgeted)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
                          {formatCurrency(incomeTotals.received)}
                        </td>
                        <td
                          className={`py-2 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${incomeTotals.budgeted > incomeTotals.received ? 'text-positive' : 'text-text-tertiary'}`}
                        >
                          {formatCurrency(
                            Math.max(incomeTotals.budgeted - incomeTotals.received, 0),
                          )}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* Expenses section header */}
                  <tr
                    data-guide="budget.columns"
                    className="group cursor-pointer select-none"
                    onClick={() => setExpensesCollapsed((c) => !c)}
                  >
                    <td className={`${BAND} py-2 px-4`}>
                      <div className="flex items-center gap-2">
                        <span className="text-text-tertiary shrink-0">
                          {expensesCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </span>
                        <span className="text-xs font-semibold text-text-secondary">Expenses</span>
                        <button
                          type="button"
                          aria-pressed={selectMode}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectMode();
                          }}
                          title="Tick envelopes to see only those in the side panel"
                          className={`ml-2 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${selectMode ? 'bg-brand-50 text-brand-700' : 'border border-border text-text-secondary hover:bg-hover hover:text-text'}`}
                        >
                          {selectMode ? 'Done selecting' : 'Select'}
                        </button>
                      </div>
                    </td>
                    <td
                      className={`${BAND} py-2 px-3 text-right text-xs font-semibold text-text-tertiary`}
                    >
                      Assigned
                    </td>
                    <td
                      className={`${BAND} py-2 px-3 text-right text-xs font-semibold text-text-tertiary`}
                    >
                      Activity
                    </td>
                    <td className={`${BAND} py-2 pl-3 pr-6 text-right text-xs font-bold text-text`}>
                      Available
                    </td>
                  </tr>

                  {!expensesCollapsed && (
                    <>
                      {shownExpensesByType.map((bt) => (
                        <BudgetTypeSection
                          key={bt.key}
                          label={bt.label}
                          categories={bt.categories}
                          editingId={editingId}
                          month={selectedMonth}
                          onStartEdit={beforeStart ? undefined : setEditingId}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          onApplyBulk={handleApplyBulk}
                          showAll={showEvery}
                          selectedIds={selectedIds}
                          onToggleSelect={selectMode ? toggleSelected : undefined}
                        />
                      ))}

                      {/* Total Expenses row */}
                      <tr className="bg-surface border-y border-border">
                        <td className="py-2 px-4 text-sm font-bold text-text">Total expenses</td>
                        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                          {formatCurrency(expenseTotals.budgeted)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                          {formatCurrency(expenseTotals.spent)}
                        </td>
                        <td
                          className={`py-2 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${expBalColor}`}
                        >
                          {formatCurrency(expRemaining)}
                        </td>
                      </tr>
                    </>
                  )}

                  {shownCardCategories.length > 0 && (
                    <BudgetTypeSection
                      label="Card payments"
                      categories={shownCardCategories}
                      editingId={editingId}
                      month={selectedMonth}
                      onStartEdit={beforeStart ? undefined : setEditingId}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                      onApplyBulk={handleApplyBulk}
                      showAll
                      cards={cardPositions}
                    />
                  )}

                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-sm text-text-tertiary">
                        No categories yet.{' '}
                        <Link
                          to={MANAGE_CATEGORIES_LINK}
                          className="font-medium text-brand-600 hover:text-brand-700"
                        >
                          Add categories
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {isPhone ? (
            !needle && <div className="p-4 space-y-4">{sideExtras}</div>
          ) : (
            <div className="w-80 shrink-0 border-l border-border p-4 self-start sticky top-0">
              {/* Ready to assign leads: it is the next step for the whole month */}
              <div className="flex flex-col gap-4">
                <div>{summaryPanel}</div>
                {sideExtras}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

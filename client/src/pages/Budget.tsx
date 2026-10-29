import { CardPayments } from '../components/budget/CardPayments';
import { MoneyMoves } from '../components/budget/MoneyMoves';
import { AssistantSuggestions } from '../components/budget/AssistantSuggestions';
import { useState, useRef, useMemo, type ElementRef } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
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
import {
  formatCurrency,
  parseCents,
  centsToInput,
  isUnreadableAmount,
  UNREADABLE_AMOUNT,
} from '../utils/currency';
import { BudgetSummaryWidget } from '../components/budget/BudgetSummaryWidget';
import { BudgetEditPopover } from '../components/budget/BudgetEditPopover';
import { Button, ButtonLink } from '../components/ui/Button';
import { targetLabel } from '../utils/targets';
import { FundTargets } from '../components/budget/FundTargets';
import { AutoAssign } from '../components/budget/AutoAssign';
import { SpentBar } from '../components/budget/SpentBar';
import { PhoneBudget } from '../components/budget/PhoneBudget';
import { PaydayPlan } from '../components/budget/PaydayPlan';
import { MissingRatesBanner } from '../components/currency/MissingRatesBanner';
import { useIsPhone } from '../hooks/useIsPhone';
import { useCanSave } from '../hooks/useConnection';
import { ExternalLink } from '../components/ui/ExternalLink';
import { docsUrl } from '../utils/project';
import { categoryFigures, splitCategories } from '../utils/budgetFigures';
import { TransferredNote } from '../components/budget/TransferredNote';
import { ExpectedNote } from '../components/budget/ExpectedNote';
import type { BudgetCategory, BudgetGroup, BudgetType } from '../types';

function AmountInput({
  cents,
  label,
  closed,
  onDraft,
  onSave,
  onCancel,
}: {
  cents: number;
  label: string;
  /** Set once the editor has already saved or cancelled, so leaving the field does nothing */
  closed: { current: boolean };
  /** The amount typed so far, or null while it isn't readable */
  onDraft: (c: number | null) => void;
  onSave: (c: number) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(centsToInput(cents));
  const [invalid, setInvalid] = useState(false);

  return (
    <input
      autoFocus
      aria-label={label}
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        setInvalid(false);
        onDraft(isUnreadableAmount(e.target.value) ? null : parseCents(e.target.value));
      }}
      aria-invalid={invalid || undefined}
      title={invalid ? UNREADABLE_AMOUNT : undefined}
      // Select the amount so typing replaces it
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Text that isn't an amount stays open to fix, rather than saving 0
          if (isUnreadableAmount(raw)) setInvalid(true);
          else (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          closed.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (closed.current) return;
        // Left with text that isn't an amount: keep the planned amount it had
        if (isUnreadableAmount(raw)) onCancel();
        else onSave(parseCents(raw));
      }}
      className={`w-28 text-right tabular-nums text-sm bg-surface border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 ${invalid ? 'border-negative focus:ring-negative' : 'border-brand-500 focus:ring-brand-600'}`}
    />
  );
}

interface CategoryRowProps {
  cat: BudgetCategory;
  isIncome: boolean;
  editingId: string | null;
  month: string;
  onStartEdit: (id: string) => void;
  onSave: (cents: number) => void;
  onCancel: () => void;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
}

function CategoryRow({
  cat,
  isIncome,
  editingId,
  month,
  onStartEdit,
  onSave,
  onCancel,
  onApplyBulk,
}: CategoryRowProps) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  // Offline: amounts can't be saved, so they can't be edited (and an open editor closes)
  const canSave = useCanSave();
  const isEditing = editingId === cat.id && canSave;
  const { actual, remaining } = categoryFigures(cat, isIncome);
  const [draft, setDraft] = useState<number | null>(cat.budgeted);
  const closed = useRef(false);
  function startEdit() {
    closed.current = false;
    setDraft(cat.budgeted);
    onStartEdit(cat.id);
  }
  // A quick amount saves straight away and closes the editor
  function pick(cents: number) {
    closed.current = true;
    onSave(cents);
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

  let remainingClass: string;
  const pillBase = 'font-medium rounded-full px-2.5 py-0.5 text-text';
  if (remaining > 0) {
    remainingClass = `${pillBase} bg-positive/20`;
  } else if (remaining < 0) {
    remainingClass = `${pillBase} bg-negative/20`;
  } else {
    remainingClass = `${pillBase} bg-surface-alt`;
  }

  return (
    <tr className="border-b border-border-light">
      <td className="py-1.5 pb-2 pl-10 pr-3">
        <div className="text-sm text-text">
          {showCategoryIcons && cat.icon && <span className="text-xs mr-1">{cat.icon}</span>}
          {cat.name}
        </div>
        <SpentBar
          spent={isIncome ? actual : cat.spent}
          budgeted={cat.budgeted + (cat.transferred ?? 0)}
          isIncome={isIncome}
          expected={cat.expected}
        />
        <TransferredNote cat={cat} className="mt-0.5" />
        {cat.target && (
          <p
            className={`text-xs mt-0.5 ${cat.target.underfunded ? 'text-caution' : 'text-text-tertiary'}`}
          >
            {targetLabel(cat.target)}
          </p>
        )}
      </td>
      <td className="py-1.5 px-3 text-right align-top">
        <div className="relative inline-block">
          {isEditing ? (
            <>
              <AmountInput
                cents={cat.budgeted}
                label={isIncome ? `Expected from ${cat.name}` : `Planned for ${cat.name}`}
                closed={closed}
                onDraft={setDraft}
                onSave={onSave}
                onCancel={onCancel}
              />
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
            </>
          ) : (
            <button
              onClick={startEdit}
              disabled={!canSave}
              title={canSave ? undefined : 'Saving is paused until FlyBudget reconnects'}
              aria-label={`${isIncome ? 'Expected from' : 'Planned for'} ${cat.name}: ${formatCurrency(cat.budgeted)}`}
              className="tabular-nums text-sm rounded px-2 py-0.5 min-w-[5.5rem] text-right border border-border bg-surface transition-colors hover:border-text-tertiary cursor-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-text-secondary">{formatCurrency(cat.budgeted)}</span>
            </button>
          )}
        </div>
      </td>
      <td className="py-1.5 px-3 align-top">
        <div className="text-right">
          <Link
            to={`/budget/category/${cat.id}`}
            className="tabular-nums text-sm text-text-secondary hover:text-brand-600 cursor-pointer transition-colors"
          >
            {formatCurrency(actual)}
          </Link>
          <ExpectedNote cat={cat} />
        </div>
      </td>
      <td className="py-1.5 pl-3 pr-6 text-right align-top">
        <span className={`tabular-nums text-sm inline-block ${remainingClass}`}>
          {formatCurrency(remaining)}
        </span>
      </td>
    </tr>
  );
}

interface IncomeGroupProps {
  group: BudgetGroup;
  editingId: string | null;
  month: string;
  onStartEdit: (id: string) => void;
  onSave: (categoryId: string, cents: number) => void;
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
  budgetType: BudgetType;
  label: string;
  categories: BudgetCategory[];
  editingId: string | null;
  month: string;
  onStartEdit: (id: string) => void;
  onSave: (categoryId: string, cents: number) => void;
  onCancel: () => void;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
  showAll: boolean;
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
}: BudgetTypeSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
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

const BUDGET_TYPES: { key: BudgetType; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'flexible', label: 'Flexible' },
  { key: 'non_monthly', label: 'Non-Monthly' },
  { key: 'savings', label: 'Savings/Investments' },
];

export default function BudgetPage() {
  const [paydayView, setPaydayView] = useState(false);
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
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

  // The jump field narrows the list to matching categories (inactive ones included)
  const needle = query.trim().toLowerCase();
  const matches = (c: BudgetCategory) => c.name.toLowerCase().includes(needle);
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
  function handleSave(categoryId: string, budgeted: number) {
    if (switchingMonth) return;
    setBudgetMutation.mutate({ month: selectedMonth, categoryId, budgeted });
    setEditingId(null);
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
    .filter((c) => c.target?.underfunded).length;
  const tbb = summary?.toBeBudgeted ?? 0;
  const carryOver = summary?.carryOver ?? 0;
  const expRemaining = expenseTotals.balance;
  const expBalColor =
    expRemaining > 0 ? 'text-positive' : expRemaining < 0 ? 'text-negative' : 'text-text-tertiary';

  if (paydayView)
    return (
      <div className="flex flex-col h-full bg-surface text-text">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setPaydayView(false)}>
            Monthly budget
          </Button>
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight">
            Until next payday
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PaydayPlan />
        </div>
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-surface">
      <div
        data-testid="budget-header"
        className="px-6 max-md:px-4 py-4 max-md:py-3 border-b border-border shrink-0"
      >
        <div className="flex flex-wrap gap-3 max-md:gap-2 items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-lg font-semibold text-text">
              {format(monthDate, 'MMMM yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isPhone && (
              <>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  to={`/budget/year/${selectedMonth.slice(0, 4)}`}
                >
                  Year
                </ButtonLink>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => autoAssignRef.current?.open()}
                  disabled={!canSaveBudget}
                >
                  Auto-assign
                </Button>
                {underfundedCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fundTargetsRef.current?.open()}
                    disabled={!canSaveBudget}
                  >
                    Fund targets ({underfundedCount})
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setPaydayView(true)}>
                  Until next payday
                </Button>
              </>
            )}
            <AutoAssign ref={autoAssignRef} month={selectedMonth} hideButton />
            <FundTargets ref={fundTargetsRef} month={selectedMonth} groups={groups} hideButton />
            <button
              onClick={() => setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
              aria-label="Previous month"
              className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md border border-border bg-surface-alt hover:bg-hover text-text-secondary hover:text-text transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
              aria-label="Next month"
              className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md border border-border bg-surface-alt hover:bg-hover text-text-secondary hover:text-text transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <Button variant="secondary" size="sm" onClick={goToToday}>
              Today
            </Button>
            {isPhone && (
              <div className="relative">
                <button
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
                      role="menu"
                      className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-border bg-surface shadow-lg py-1"
                    >
                      <Link
                        role="menuitem"
                        to={`/budget/year/${selectedMonth.slice(0, 4)}`}
                        className="flex items-center min-h-11 px-4 text-sm text-text hover:bg-hover"
                      >
                        Year
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
        <div className="relative mt-3 max-md:mt-2">
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
            className="w-full max-w-sm max-md:max-w-none text-sm border border-border rounded-lg pl-8 pr-8 py-1.5 max-md:min-h-11 bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 [&::-webkit-search-cancel-button]:hidden"
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
      </div>

      {nothingPlanned && !beforeStart && !(isPhone && needle) && (
        <div className="flex items-start gap-3 px-6 py-3 bg-brand-50 border-b border-border-light text-sm text-text-secondary shrink-0">
          <Lightbulb size={16} className="text-brand-600 shrink-0 mt-0.5" aria-hidden />
          <p>
            No assignments for {format(monthDate, 'MMMM')} yet. {isPhone ? 'Tap' : 'Click'} an
            amount to assign money you already have to an envelope.
            {!isPhone &&
              " Income you receive is ready to assign straight away; amounts beside income are only what you expect. Expense balances carry forward. Categories you leave empty are tucked away once you've planned something."}{' '}
            <ExternalLink
              href={docsUrl('budgeting')}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              How budgeting works
            </ExternalLink>
          </p>
        </div>
      )}

      {(setBudgetMutation.error || setBulkMutation.error) && (
        <AssignBlockError error={(setBudgetMutation.error || setBulkMutation.error)!} />
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

      {/* Phones: the summary (with To Be Budgeted) goes above the table instead of beside it */}
      {/* While the next month loads, the previous one stays (faded) so nothing jumps */}
      <div
        aria-busy={switchingMonth}
        inert={switchingMonth}
        className={`flex max-md:flex-col flex-1 overflow-y-auto transition-opacity ${switchingMonth ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="flex-1 max-md:flex-none max-md:order-last max-md:overflow-x-auto">
          {isPhone ? (
            <PhoneBudget
              sections={[
                ...shownIncomeGroups.map((g) => ({
                  key: g.id,
                  label: g.name,
                  isIncome: true,
                  categories: g.categories,
                })),
                ...shownExpensesByType.map((bt) => ({
                  key: bt.key,
                  label: bt.label,
                  isIncome: false,
                  categories: bt.categories,
                })),
              ]}
              month={selectedMonth}
              onSave={handleSave}
              onApplyBulk={handleApplyBulk}
              showAll={showEvery}
              readOnly={beforeStart}
            />
          ) : (
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: '55%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <tbody>
                {/* Income section header */}
                <tr
                  className="bg-surface-alt border-y border-border cursor-pointer select-none hover:bg-hover transition-colors"
                  onClick={() => setIncomeCollapsed((c) => !c)}
                >
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-text-tertiary shrink-0">
                        {incomeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </span>
                      <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                        Income
                      </span>
                    </div>
                  </td>
                  <td
                    className="py-2 px-3 text-right text-xs font-semibold text-text-tertiary"
                    title="What you expect to earn. It's a plan, not money: only income you've received is ready to assign."
                  >
                    Expected
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-semibold text-text-tertiary">
                    Received
                  </td>
                  <td className="py-2 pl-3 pr-6 text-right text-xs font-bold text-text">
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
                        onStartEdit={beforeStart ? () => undefined : setEditingId}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                        onApplyBulk={handleApplyBulk}
                        showAll={showEvery}
                      />
                    ))}

                    {/* Total Income row */}
                    <tr className="bg-surface border-y border-border">
                      <td className="py-2 px-4 text-sm font-bold text-text">Total Income</td>
                      <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                        {formatCurrency(incomeTotals.budgeted)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold text-text">
                        {formatCurrency(incomeTotals.received)}
                      </td>
                      <td className="py-2 pl-3 pr-6" />
                    </tr>
                  </>
                )}

                {/* Expenses section header */}
                <tr
                  className="bg-surface-alt border-y border-border cursor-pointer select-none hover:bg-hover transition-colors"
                  onClick={() => setExpensesCollapsed((c) => !c)}
                >
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-text-tertiary shrink-0">
                        {expensesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </span>
                      <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                        Expenses
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-semibold text-text-tertiary">
                    Assigned
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-semibold text-text-tertiary">
                    Activity
                  </td>
                  <td className="py-2 pl-3 pr-6 text-right text-xs font-bold text-text">
                    Available
                  </td>
                </tr>

                {!expensesCollapsed && (
                  <>
                    {shownExpensesByType.map((bt) => (
                      <BudgetTypeSection
                        key={bt.key}
                        budgetType={bt.key}
                        label={bt.label}
                        categories={bt.categories}
                        editingId={editingId}
                        month={selectedMonth}
                        onStartEdit={beforeStart ? () => undefined : setEditingId}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                        onApplyBulk={handleApplyBulk}
                        showAll={showEvery}
                      />
                    ))}

                    {/* Total Expenses row */}
                    <tr className="bg-surface border-y border-border">
                      <td className="py-2 px-4 text-sm font-bold text-text">Total Expenses</td>
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

                {groups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-sm text-text-tertiary">
                      No categories yet.{' '}
                      <Link
                        to="/settings?tab=categories"
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        Add some in Settings
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div
          className={`w-80 max-md:w-full shrink-0 border-l max-md:border-l-0 max-md:border-b border-border p-4 self-start max-md:self-stretch sticky max-md:static top-0 ${needle ? 'max-md:hidden' : ''}`}
        >
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
            <BudgetSummaryWidget
              funding={summary}
              expenseAvailable={expenseTotals.balance}
              toBeBudgeted={tbb}
              carryOver={carryOver}
              incomePlanned={incomeTotals.budgeted}
              incomeEarned={incomeTotals.received}
              expensesPlanned={expenseTotals.budgeted}
              expensesSpent={Math.max(0, -expenseTotals.spent)}
              savingsPlanned={savingsTotals.budgeted}
              savingsContributed={savingsTotals.spent}
              fixedExpenses={expensesByBudgetType.fixed}
              flexibleExpenses={expensesByBudgetType.flexible}
              nonMonthlyExpenses={expensesByBudgetType.nonMonthly}
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
          </div>
        </div>
      </div>
    </div>
  );
}

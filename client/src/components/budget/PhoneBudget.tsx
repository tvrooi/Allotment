import { useState } from 'react';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, Pencil } from 'lucide-react';
import { SpentBar } from './SpentBar';
import { BudgetAmountSheet } from './BudgetAmountSheet';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useCanSave } from '../../hooks/useConnection';
import { canMoveIn, useMoveRequest } from '../../store/moveRequestStore';
import { formatCurrency } from '../../utils/currency';
import {
  availability,
  availableTone,
  captionTone,
  categoryFigures,
  splitCategories,
} from '../../utils/budgetFigures';
import { TransferredNote, useLinkedAccount } from './TransferredNote';
import { ExpectedNote } from './ExpectedNote';
import { CardRowNotes } from './CardRowNotes';
import type { CardPosition } from '../../api/budget';
import type { BudgetCategory } from '../../types';
import { targetLabel } from '../../utils/targets';

export interface PhoneBudgetSection {
  key: string;
  label: string;
  isIncome: boolean;
  categories: BudgetCategory[];
  /** List every category, however quiet (a card's payment envelope is always shown) */
  always?: boolean;
}

interface Props {
  sections: PhoneBudgetSection[];
  month: string;
  /** Resolves to why the save was refused, or null once it has been saved */
  onSave: (categoryId: string, cents: number) => Promise<string | null>;
  onApplyBulk: (categoryId: string, cents: number, expected: Record<string, number>) => void;
  /** Nothing is planned this month yet: list every category, so there's something to plan */
  showAll?: boolean;
  /** Before the budget start: figures to read, nothing to assign */
  readOnly?: boolean;
  /** Card positions by payment envelope, shown under the envelope's name */
  cards?: Map<string, CardPosition>;
}

/**
 * The budget on a phone: a card per category (planned, actual, remaining) instead of the
 * four-column table. Tapping the planned amount opens a sheet to change it.
 */
export function PhoneBudget({
  sections,
  month,
  onSave,
  onApplyBulk,
  showAll = false,
  readOnly = false,
  cards,
}: Props) {
  const [editing, setEditing] = useState<{ cat: BudgetCategory; isIncome: boolean } | null>(null);
  const firstExpenses = sections.find((s) => !s.isIncome);

  return (
    <div>
      {sections.map((section) => {
        const el = (
          <Section
            key={section.key}
            section={section}
            showAll={showAll || !!section.always}
            readOnly={readOnly}
            month={month}
            cards={cards}
            onEdit={(cat) => setEditing({ cat, isIncome: section.isIncome })}
          />
        );
        // The guides' "Categories are envelopes" step points at the first envelopes, not income
        return section === firstExpenses ? (
          <div key={section.key} data-guide="budget.expenses">
            {el}
          </div>
        ) : (
          el
        );
      })}
      <BudgetAmountSheet
        category={editing?.cat ?? null}
        isIncome={editing?.isIncome ?? false}
        month={month}
        onClose={() => setEditing(null)}
        onSave={onSave}
        onApplyBulk={onApplyBulk}
      />
    </div>
  );
}

function Section({
  section,
  showAll,
  readOnly,
  month,
  cards,
  onEdit,
}: {
  section: PhoneBudgetSection;
  showAll: boolean;
  readOnly: boolean;
  month: string;
  cards?: Map<string, CardPosition>;
  onEdit: (cat: BudgetCategory) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { isIncome, categories } = section;
  const { shown, hidden } = splitCategories(categories, isIncome);
  const inactiveCount = hidden.length;
  const visible = showInactive || showAll ? categories : shown;
  const planned = categories.reduce((s, c) => s + c.budgeted, 0);
  const actual = categories.reduce((s, c) => s + categoryFigures(c, isIncome).actual, 0);

  return (
    <section aria-label={section.label} className="border-b border-border">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="w-full min-h-11 flex items-center gap-2 px-4 py-2 bg-surface-alt text-left"
      >
        {collapsed ? (
          <ChevronRight size={16} className="text-text-tertiary" aria-hidden />
        ) : (
          <ChevronDown size={16} className="text-text-tertiary" aria-hidden />
        )}
        <span className="flex-1 text-sm font-semibold text-text">{section.label}</span>
        <span className="text-xs text-text-tertiary tabular-nums">
          {isIncome
            ? `${formatCurrency(actual)} of ${formatCurrency(planned)} expected`
            : `${formatCurrency(categories.reduce((s, c) => s + c.balance, 0))} available`}
        </span>
      </button>
      {!collapsed && (
        <>
          {visible.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              isIncome={isIncome}
              readOnly={readOnly}
              month={month}
              card={cards?.get(cat.id)}
              onEdit={() => onEdit(cat)}
            />
          ))}
          {inactiveCount > 0 && !showAll && (
            <button
              type="button"
              onClick={() => setShowInactive((s) => !s)}
              className="w-full min-h-11 flex items-center gap-1.5 px-4 text-sm text-text-tertiary"
            >
              <Eye size={14} aria-hidden />
              {showInactive ? 'Hide' : 'Show'} {inactiveCount} inactive{' '}
              {inactiveCount === 1 ? 'category' : 'categories'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function CategoryCard({
  cat,
  isIncome,
  readOnly,
  month,
  card,
  onEdit,
}: {
  cat: BudgetCategory;
  isIncome: boolean;
  readOnly: boolean;
  month: string;
  card?: CardPosition;
  onEdit: () => void;
}) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const canSave = useCanSave();
  const { actual } = categoryFigures(cat, isIncome);
  const { kind, remaining, caption } = availability(cat, isIncome);
  const askToMove = useMoveRequest((s) => s.ask);
  // An envelope linked to an account holds what the account holds: a transfer moves its money
  const linked = useLinkedAccount(cat);
  const movable =
    !isIncome && !linked && canSave && !readOnly && remaining !== 0 && canMoveIn(month);
  const pill = availableTone(kind, remaining);

  return (
    // relative: keeps the sr-only text inside the card, or it's placed against the page and
    // makes the whole window scroll
    <div
      className="relative px-4 py-3 border-t border-border-light bg-surface"
      data-testid="budget-card"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-row font-medium text-text inline-flex items-center gap-1.5">
          {showCategoryIcons && <CategoryIcon icon={cat.icon} size={15} />}
          {cat.name}
        </span>
        {movable ? (
          // Tapping the figure opens Move money with this envelope filled in (BUD-06)
          <button
            type="button"
            onClick={() => askToMove(cat.id, remaining)}
            aria-label={
              remaining < 0
                ? `Cover ${cat.name}: ${formatCurrency(-remaining)} overspent`
                : `Move money from ${cat.name}: ${formatCurrency(remaining)} available${caption ? `, ${caption.toLowerCase()}` : ''}`
            }
            className={`shrink-0 min-h-11 -my-2 rounded-full px-2.5 text-sm tabular-nums ${pill}`}
          >
            {formatCurrency(remaining)}
            {/* Read as text too (the label above is what a screen reader announces) */}
            <span className="sr-only"> available</span>
          </button>
        ) : (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm tabular-nums ${pill}`}>
            {formatCurrency(remaining)}
            <span className="sr-only">
              {' '}
              {isIncome ? 'remaining' : 'available'}
              {caption ? `, ${caption.toLowerCase()}` : ''}
            </span>
          </span>
        )}
      </div>
      {caption && <p className={`mt-1 text-right text-xs ${captionTone(kind)}`}>{caption}</p>}
      <SpentBar
        spent={isIncome ? actual : cat.spent}
        budgeted={cat.budgeted + (cat.transferred ?? 0)}
        isIncome={isIncome}
        expected={cat.expected}
        covered={kind !== 'overspent'}
        className="h-1.5 w-full mt-2"
      />
      <TransferredNote cat={cat} className="mt-1" />
      {card && <CardRowNotes card={card} className="mt-1" />}
      {cat.target && (
        <p
          className={`text-xs mt-1 ${cat.target.underfunded ? 'text-caution' : 'text-text-tertiary'}`}
        >
          {targetLabel(cat.target, linked?.name)}
        </p>
      )}
      <div className="mt-1 grid grid-cols-2 gap-2">
        {linked && !isIncome ? (
          // It holds what the account holds: a transfer moves its money, not an assignment
          <span className="min-h-11 grid content-center text-left">
            <span className="text-xs text-text-tertiary">Moved to {linked.name}</span>
            <span className="text-sm font-medium tabular-nums text-text">
              {formatCurrency(cat.budgeted + (cat.transferred ?? 0))}
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            disabled={!canSave || readOnly}
            aria-label={`Assigned to ${cat.name}: ${formatCurrency(cat.budgeted)}`}
            className="min-h-11 flex items-center gap-1.5 text-left disabled:opacity-50"
          >
            <span className="grid">
              <span className="text-xs text-text-tertiary">
                {isIncome ? 'Expected' : 'Assigned'}
              </span>
              <span className="text-sm font-medium tabular-nums text-text">
                {formatCurrency(cat.budgeted)}
              </span>
            </span>
            <Pencil size={13} className="text-text-tertiary" aria-hidden />
          </button>
        )}
        <Link
          to={`/budget/category/${cat.id}`}
          className="min-h-11 grid justify-items-end content-center text-right"
        >
          <span className="text-xs text-text-tertiary">{isIncome ? 'Received' : 'Activity'}</span>
          <span className="text-sm font-medium tabular-nums text-text">
            {formatCurrency(actual)}
          </span>
          <ExpectedNote cat={cat} />
        </Link>
      </div>
    </div>
  );
}

import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { createCategory as createCategoryRequest } from '../../api/categories';
import { useCreateCategory } from '../../hooks/useCategories';
import { usePreferencesStore } from '../../store/preferencesStore';
import type { BudgetType, CategoryGroup } from '../../types';
import { Button } from '../ui/Button';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SearchList, type SearchListPinned, type SearchListSection } from '../ui/Combobox';
import { errorClass } from '../ui/fieldClasses';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

/** The value a "Transfer: name" row picks */
const transferValue = (accountId: string) => `transfer:${accountId}`;

/**
 * The category list's sections for a search, in SearchList's section shape: each group that has
 * a match, in the order given, then a "Transfer" section of "Transfer: name" rows when one
 * matches. Matching is a lower-cased substring of the category's name or of "Transfer: name".
 * Hidden categories are left out, except the chosen one.
 */
export function categorySections(
  groups: readonly CategoryGroup[],
  transferAccounts: readonly { id: string; name: string }[],
  query: string,
  value: string | null | undefined,
): SearchListSection[] {
  const text = query.toLowerCase();
  const sections: SearchListSection[] = groups
    .map((g) => ({
      id: g.id,
      heading: g.name,
      options: g.categories
        .filter((c) => (!c.hidden || c.id === value) && c.name.toLowerCase().includes(text))
        .map((c) => ({ value: c.id, label: c.name })),
    }))
    .filter((section) => section.options.length > 0);
  const transfers = transferAccounts
    .map((a) => ({ value: transferValue(a.id), label: `Transfer: ${a.name}` }))
    .filter((o) => o.label.toLowerCase().includes(text));
  return transfers.length > 0
    ? [...sections, { id: 'transfers', heading: 'Transfer', options: transfers }]
    : sections;
}

/**
 * Everything the arrow keys walk, in the order listed: the no-category row (null) only when it
 * is offered and nothing is typed, then every category, then every transfer. While searching
 * the no-category row still shows, but out of this order, so Enter on a search never picks it.
 */
export function categoryKeyboardOrder(
  sections: readonly SearchListSection[],
  query: string,
  allowNone: boolean,
): (string | null)[] {
  return [
    ...(allowNone && !query ? [null] : []),
    ...sections.flatMap((section) => section.options.map((o) => o.value)),
  ];
}

/** Whether "No categories found" shows: no category and no transfer matches */
export function categoryListEmpty(sections: readonly SearchListSection[]): boolean {
  return sections.every((section) => section.options.length === 0);
}

interface Props {
  value?: string | null;
  onChange: (id: string | null) => void;
  groups: CategoryGroup[];
  onClose: () => void;
  position?: 'below' | 'above';
  /** Accounts offered as "Transfer: name" at the bottom (picked as `transfer:<accountId>`) */
  transferAccounts?: { id: string; name: string }[];
  /** Fill the width of the field it opens from (phones) instead of a fixed 16rem */
  fullWidth?: boolean;
  /** Open as a floating list beside this element, so a scrolling parent can't clip it */
  anchor?: HTMLElement | null;
  /** Offer "Uncategorised" (default). A sorting step that must pick a category turns it off. */
  allowNone?: boolean;
  /** What the no-category choice says (a payee's default: "No default category") */
  noneLabel?: string;
  /**
   * Creates the category in place of the app's POST /api/categories, resolving to its id: for the
   * dev gallery, which has no server and fetches nothing (T-02-10)
   */
  onCreate?: CreateCategory;
}

/** The group, name and budget type the create form gives */
export type NewCategory = Parameters<typeof createCategoryRequest>[0];
/** Creates a category and resolves to its id; a rejection shows the form's error line */
export type CreateCategory = (category: NewCategory) => Promise<{ id: string }>;

/**
 * What the picker hands SearchList for a search: the sections from categorySections (with each
 * category's icon when the preference shows them), the no-category row, in the keys only when
 * categoryKeyboardOrder puts it there, and the empty line when categoryListEmpty says so
 */
export function categoryList({
  groups,
  transferAccounts,
  query,
  value,
  allowNone,
  noneLabel,
  showIcons,
  onChange,
}: {
  groups: readonly CategoryGroup[];
  transferAccounts: readonly { id: string; name: string }[];
  query: string;
  value: string | null | undefined;
  allowNone: boolean;
  noneLabel: string;
  showIcons: boolean;
  onChange: (id: string | null) => void;
}): {
  sections: SearchListSection[];
  pinned: SearchListPinned | undefined;
  emptyText: string | null;
  onPick: (id: string) => void;
} {
  const found = categorySections(groups, transferAccounts, query, value);
  const iconOf = new Map(groups.flatMap((g) => g.categories.map((c) => [c.id, c.icon])));
  const sections = showIcons
    ? found.map((section) => ({
        ...section,
        options: section.options.map((o) => {
          const icon = iconOf.get(o.value);
          return icon ? { ...o, icon: <CategoryIcon icon={icon} size={16} /> } : o;
        }),
      }))
    : found;
  return {
    sections,
    pinned: allowNone
      ? {
          label: noneLabel,
          isSelected: value === null,
          onPick: () => onChange(null),
          inKeyboardOrder: categoryKeyboardOrder(found, query, allowNone)[0] === null,
        }
      : undefined,
    emptyText: categoryListEmpty(found) ? 'No categories found' : null,
    onPick: onChange,
  };
}

const BUDGET_TYPES: [BudgetType, string][] = [
  ['fixed', 'Fixed'],
  ['flexible', 'Flexible'],
  ['non_monthly', 'Non-Monthly'],
];

/**
 * The list's footer: "Create new category", which opens a form for the group, the budget type
 * (not for an income group) and the name. A created category is picked; a failed create keeps
 * the form and its name, with an error line.
 */
function CreateCategoryForm({
  groups,
  onCreated,
  onCreate,
}: {
  groups: readonly CategoryGroup[];
  onCreated: (id: string) => void;
  onCreate?: CreateCategory;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState(groups[0]?.id ?? '');
  const [newBudgetType, setNewBudgetType] = useState<BudgetType>('flexible');
  const nameRef = useRef<HTMLInputElement>(null);
  const appCreate = useCreateCategory();
  // The app's create (its request, cache refresh and undo), or a caller's own (the gallery's),
  // through the same pending and error states
  const createCategory = useMutation({
    mutationFn: (category: NewCategory) =>
      onCreate ? onCreate(category) : appCreate.mutateAsync(category),
  });

  useEffect(() => {
    if (showCreate) nameRef.current?.focus();
  }, [showCreate]);

  const isIncomeGroup = groups.find((g) => g.id === newGroupId)?.isIncome === 1;

  function handleCreate() {
    if (!newName.trim() || !newGroupId || createCategory.isPending) return;
    createCategory.mutate(
      {
        groupId: newGroupId,
        name: newName.trim(),
        budgetType: isIncomeGroup ? null : newBudgetType,
      },
      {
        onSuccess: (created: { id: string }) => {
          onCreated(created.id);
        },
      },
    );
  }

  if (!showCreate)
    return (
      <div className="p-1">
        <Button
          variant="ghost"
          className="w-full text-brand-600"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} aria-hidden="true" />
          Create new category
        </Button>
      </div>
    );

  return (
    <div className="space-y-2 p-3">
      <Select
        aria-label="New category group"
        fieldSize="sm"
        value={newGroupId}
        onChange={setNewGroupId}
        options={groups.map((g) => ({ value: g.id, label: g.name }))}
      />
      {!isIncomeGroup && (
        <div className="flex flex-wrap gap-1">
          {BUDGET_TYPES.map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={newBudgetType === key ? 'primary' : 'secondary'}
              aria-pressed={newBudgetType === key}
              className="flex-1"
              onClick={() => setNewBudgetType(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      <Input
        ref={nameRef}
        type="text"
        fieldSize="sm"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Category name"
        aria-label="New category name"
        isInvalid={createCategory.isError}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
          }
        }}
      />
      {createCategory.isError && (
        <p role="alert" className={errorClass}>
          Couldn&apos;t create the category. Try again.
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleCreate}
          disabled={!newName.trim() || createCategory.isPending}
        >
          {createCategory.isPending ? 'Creating...' : 'Create'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Cancel new category"
          onClick={() => {
            setShowCreate(false);
            setNewName('');
            createCategory.reset();
          }}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Anchored: at least 16rem and at least the anchor's width (popoverClass caps it at the screen
 * less 16 px)
 */
const ANCHORED_WIDTH = 'w-[max(var(--trigger-width),16rem)]';

/**
 * The category picker (D-05): the shared searchable list with the category rules above and the
 * create form as its footer. Rendering it means it is open; it calls onClose on Escape or a
 * click outside, and onChange with the picked id (null for the no-category row).
 *
 * With `anchor` the list floats beside that element (drawn at the end of the page, so a
 * scrolling parent can't clip it) and React Aria flips it above when there is little room
 * below. Without one it opens in the caller's relative wrapper, below or above per `position`:
 * a zero-height box there is the list's trigger and holds its portal, so the list stays in the
 * caller's dialog, row or form, 16rem wide, or the wrapper's width on phones with `fullWidth`.
 */
export function CategoryPicker({
  value,
  onChange,
  groups,
  onClose,
  position = 'below',
  transferAccounts = [],
  fullWidth = false,
  anchor = null,
  allowNone = true,
  noneLabel = 'Uncategorised',
  onCreate,
}: Props) {
  const [query, setQuery] = useState('');
  const [spot, setSpot] = useState<HTMLDivElement | null>(null);
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
  const spotRef = useMemo(() => ({ current: spot }), [spot]);
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);

  const list = {
    // The raised card the picker has always had, over the list popover's lighter one
    className: 'shadow-lg!',
    searchLabel: 'Search categories',
    searchPlaceholder: 'Search categories...',
    query,
    onQueryChange: setQuery,
    value: value ?? null,
    onClose,
    footer: <CreateCategoryForm groups={groups} onCreated={onChange} onCreate={onCreate} />,
    ...categoryList({
      groups,
      transferAccounts,
      query,
      value,
      allowNone,
      noneLabel,
      showIcons,
      onChange,
    }),
  };

  if (anchor) return <SearchList {...list} triggerRef={anchorRef} width={ANCHORED_WIDTH} />;
  return (
    <div
      ref={setSpot}
      className={`absolute left-0 h-0 ${fullWidth ? 'w-64 max-md:w-full' : 'w-64'} ${position === 'above' ? 'bottom-full' : 'top-full'}`}
    >
      {spot && (
        <SearchList
          {...list}
          triggerRef={spotRef}
          portalContainer={spot}
          placement={position === 'above' ? 'top start' : 'bottom start'}
          width="w-[var(--trigger-width)]"
        />
      )}
    </div>
  );
}

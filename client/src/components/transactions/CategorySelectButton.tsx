import { useMemo, useState } from 'react';
import { CategoryIcon } from '../ui/CategoryIcon';
import { ChevronDown } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { usePreferencesStore } from '../../store/preferencesStore';
import { CategoryPicker, DEFAULT_NONE_LABEL, type CategoryExtraItem } from './CategoryPicker';
import { fieldBase, fieldHeights, fieldStates } from '../ui/fieldClasses';
import type { CategoryGroup } from '../../types';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  position?: 'below' | 'above';
  placeholder?: string;
  /** Accessible name prefix for the trigger button (`${label}: ${shown}`); defaults to 'Category' */
  label?: string;
  /** Also offer "Transfer: name" for these accounts (picked as `transfer:<accountId>`) */
  transferAccounts?: { id: string; name: string }[];
  /** Optional extra non-category item pinned ahead of the categories (off by default) */
  extraItem?: CategoryExtraItem;
  /** Optional per-category suffix appended after each category name (off by default) */
  hint?: (categoryId: string) => string;
  /** Forwarded to CategoryPicker; when true and value is null, the button shows noneLabel */
  allowNone?: boolean;
  /** Label for the no-category choice when allowNone is enabled */
  noneLabel?: string;
  /** When given, used instead of useCategories() both for the picker list and the shown name */
  groups?: CategoryGroup[];
  /**
   * When given, only these categories are offered, in their groups (a group left empty is
   * dropped): a screen's own subset, such as the envelopes a panel was given
   */
  categoryIds?: readonly string[];
  /** Forwarded to CategoryPicker (default true). Set false where creating categories is out of place. */
  allowCreate?: boolean;
  /** Forwarded to CategoryPicker (default false). Set true to keep hidden categories selectable. */
  includeHidden?: boolean;
  /**
   * Forwarded to CategoryPicker (default false): on a phone the list opens as a calm drawer, flush
   * with the button and with its search left for a tap (owner, 21 November 2026, UAT G-03-1; the
   * Add transaction Category field is the one caller)
   */
  phoneDrawer?: boolean;
  /** For a visible <label htmlFor> beside the button */
  id?: string;
}

/** The groups holding only the given categories, in their order, without groups left empty */
function onlyCategories(groups: readonly CategoryGroup[], ids: readonly string[]): CategoryGroup[] {
  const wanted = new Set(ids);
  return groups
    .map((g) => ({ ...g, categories: g.categories.filter((c) => wanted.has(c.id)) }))
    .filter((g) => g.categories.length > 0);
}

/** Resolves only what the button owns (groups); optional picker props fall through to CategoryPicker's defaults */
export function categoryButtonPickerProps(
  props: Pick<
    Props,
    | 'value'
    | 'groups'
    | 'categoryIds'
    | 'transferAccounts'
    | 'allowNone'
    | 'noneLabel'
    | 'extraItem'
    | 'hint'
    | 'allowCreate'
    | 'includeHidden'
  >,
  fetchedGroups: readonly CategoryGroup[],
) {
  const { categoryIds, ...picker } = props;
  const groups = props.groups ?? (fetchedGroups as CategoryGroup[]);
  return { ...picker, groups: categoryIds ? onlyCategories(groups, categoryIds) : groups };
}

/** Category field from the Add transaction workflow: a button that opens the searchable CategoryPicker. */
export function CategorySelectButton({
  value,
  onChange,
  position = 'below',
  placeholder = 'Search categories...',
  label = 'Category',
  transferAccounts,
  extraItem,
  hint,
  allowNone,
  noneLabel,
  groups,
  categoryIds,
  allowCreate,
  includeHidden,
  phoneDrawer,
  id,
}: Props) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data: fetchedGroups = [] } = useCategories();
  const picker = categoryButtonPickerProps(
    {
      value,
      groups,
      categoryIds,
      transferAccounts,
      allowNone,
      noneLabel,
      extraItem,
      hint,
      allowCreate,
      includeHidden,
    },
    fetchedGroups as CategoryGroup[],
  );
  const [open, setOpen] = useState(false);

  const entry = useMemo(() => {
    if (value === null) {
      return picker.allowNone ? { name: picker.noneLabel ?? DEFAULT_NONE_LABEL, icon: null } : null;
    }
    if (picker.extraItem && value === picker.extraItem.value) {
      return { name: picker.extraItem.label, icon: null };
    }
    if (value.startsWith('transfer:')) {
      const account = picker.transferAccounts?.find((a) => `transfer:${a.id}` === value);
      return account ? { name: `Transfer: ${account.name}`, icon: null } : null;
    }
    for (const g of picker.groups) {
      const cat = g.categories.find((c) => c.id === value);
      if (cat) return { name: cat.name, icon: cat.icon };
    }
    return null;
  }, [
    value,
    picker.groups,
    picker.transferAccounts,
    picker.extraItem,
    picker.allowNone,
    picker.noneLabel,
  ]);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`${label}: ${entry?.name ?? placeholder}`}
        aria-expanded={open}
        className={`${fieldBase} ${fieldHeights.md} ${fieldStates} w-full text-left flex items-center justify-between cursor-pointer`}
      >
        <span className="flex items-center gap-2 truncate">
          {entry ? (
            <>
              {showCategoryIcons && <CategoryIcon icon={entry.icon} size={15} />}
              <span className="text-text">{entry.name}</span>
            </>
          ) : (
            <span className="text-text-tertiary">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-text-tertiary shrink-0" />
      </button>
      {open && (
        <CategoryPicker
          {...picker}
          onChange={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          position={position}
          fullWidth
          phoneDrawer={phoneDrawer}
        />
      )}
    </div>
  );
}

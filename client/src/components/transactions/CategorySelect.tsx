import type { Account, CategoryGroup } from '../../types';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  groups: CategoryGroup[];
  accounts?: Account[];
  currentAccountId?: string;
  className?: string;
  /** Replaces the field's own styling (the phone sheet uses full input styling, 16px text) */
  fieldClassName?: string;
  /** Accessible name; defaults to "Category" */
  label?: string;
  /** For a visible <label htmlFor> beside the field */
  id?: string;
}

export function CategorySelect({
  value,
  onChange,
  groups,
  accounts,
  currentAccountId,
  className = '',
  fieldClassName,
  label = 'Category',
  id,
}: Props) {
  const transferAccounts = accounts?.filter((a) => a.id !== currentAccountId && !a.closedAt) ?? [];

  return (
    <select
      id={id}
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={
        fieldClassName ??
        `block w-full bg-transparent text-sm text-text focus:outline-none ${className}`
      }
    >
      <option value="">Uncategorised</option>
      {groups.map((g) => (
        <optgroup key={g.id} label={g.name}>
          {g.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
      {transferAccounts.length > 0 && (
        <optgroup label="Transfer">
          {transferAccounts.map((a) => (
            <option key={a.id} value={`transfer:${a.id}`}>
              Transfer: {a.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

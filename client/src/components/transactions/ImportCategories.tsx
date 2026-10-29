import { createCategory, createGroup } from '../../api/categories';
import { fileCategoryKey, type FileCategory } from '../../utils/csv';
import { matchCategory } from '../../utils/categoryMatch';
import type { ImportRow } from '../../api/transactions';
import type { CategoryGroup } from '../../types';

/** What to do with one category of an imported file */
export type CategoryChoice =
  | { kind: 'none' }
  | { kind: 'existing'; categoryId: string }
  /** `group` is an existing group's id, or `new:<name>` for one made for the import */
  | { kind: 'new'; group: string };

export interface FileCategoryUse extends FileCategory {
  key: string;
  count: number;
}

const NEW_GROUP_FALLBACK = 'Imported categories';
const newGroup = (name: string) => `new:${name}`;

/** The distinct categories in the rows, with how many rows use each, most used first */
export function distinctFileCategories(rows: ImportRow[]): FileCategoryUse[] {
  const found = new Map<string, FileCategoryUse>();
  for (const row of rows) {
    if (!row.fileCategory) continue;
    const key = fileCategoryKey(row.fileCategory);
    const seen = found.get(key);
    if (seen) seen.count++;
    else found.set(key, { ...row.fileCategory, key, count: 1 });
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Matched by name to an existing category, else a new one in a fitting group */
export function suggestChoices(
  uses: FileCategoryUse[],
  groups: CategoryGroup[],
): Record<string, CategoryChoice> {
  const choices: Record<string, CategoryChoice> = {};
  for (const use of uses) {
    const match = matchCategory(use, groups);
    if (match) {
      choices[use.key] = { kind: 'existing', categoryId: match.id };
      continue;
    }
    const sameGroup = use.group
      ? groups.find((g) => g.name.toLowerCase() === use.group!.toLowerCase())
      : undefined;
    choices[use.key] = {
      kind: 'new',
      group: sameGroup?.id ?? newGroup(use.group ?? NEW_GROUP_FALLBACK),
    };
  }
  return choices;
}

/**
 * Makes the groups and categories the person chose to create, then returns the category each
 * file category ended up as. Runs once, when they confirm the import.
 */
export async function resolveCategoryChoices(
  uses: FileCategoryUse[],
  choices: Record<string, CategoryChoice>,
): Promise<Record<string, string | null>> {
  const resolved: Record<string, string | null> = {};
  const madeGroups = new Map<string, string>();
  for (const use of uses) {
    const choice = choices[use.key] ?? { kind: 'none' };
    if (choice.kind === 'none') resolved[use.key] = null;
    else if (choice.kind === 'existing') resolved[use.key] = choice.categoryId;
    else {
      let groupId = choice.group;
      if (groupId.startsWith('new:')) {
        const name = groupId.slice(4);
        let made = madeGroups.get(name);
        if (!made) {
          made = (await createGroup({ name, isIncome: 0 })).id;
          madeGroups.set(name, made);
        }
        groupId = made;
      }
      resolved[use.key] = (await createCategory({ groupId, name: use.name })).id;
    }
  }
  return resolved;
}

/** What a choice will do, in words (the preview and the summary use it) */
export function describeChoice(choice: CategoryChoice | undefined, groups: CategoryGroup[]) {
  if (!choice || choice.kind === 'none') return 'Uncategorised';
  if (choice.kind === 'existing')
    return (
      groups.flatMap((g) => g.categories).find((c) => c.id === choice.categoryId)?.name ??
      'Uncategorised'
    );
  return 'New category';
}

const selectClass = 'w-full text-xs border border-border rounded px-1.5 py-1 bg-surface text-text';

interface Props {
  uses: FileCategoryUse[];
  groups: CategoryGroup[];
  choices: Record<string, CategoryChoice>;
  onChange: (choices: Record<string, CategoryChoice>) => void;
}

/** "Your file's categories": map each to an existing category, create it, or leave it out */
export function ImportCategories({ uses, groups, choices, onChange }: Props) {
  const expenseGroups = groups;
  const set = (key: string, choice: CategoryChoice) => onChange({ ...choices, [key]: choice });
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto border border-border rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-surface-alt">
          <tr>
            <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
              In your file
            </th>
            <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
              In FlyBudget
            </th>
            <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">Group</th>
          </tr>
        </thead>
        <tbody>
          {uses.map((use) => {
            const choice = choices[use.key] ?? { kind: 'none' };
            const label = `${use.group ? use.group + ': ' : ''}${use.name}`;
            const newGroups = [
              ...new Set([use.group ?? NEW_GROUP_FALLBACK, NEW_GROUP_FALLBACK]),
            ].filter(
              (name) => !expenseGroups.some((g) => g.name.toLowerCase() === name.toLowerCase()),
            );
            return (
              <tr key={use.key} className="border-t border-border-light align-top">
                <td className="px-2 py-1.5 text-xs text-text">
                  {label}
                  <span className="text-text-tertiary"> · {use.count}</span>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    aria-label={`Category for ${label}`}
                    className={selectClass}
                    value={
                      choice.kind === 'existing'
                        ? choice.categoryId
                        : choice.kind === 'new'
                          ? '__new'
                          : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') set(use.key, { kind: 'none' });
                      else if (v === '__new')
                        set(use.key, {
                          kind: 'new',
                          group:
                            expenseGroups.find(
                              (g) => g.name.toLowerCase() === (use.group ?? '').toLowerCase(),
                            )?.id ?? newGroup(use.group ?? NEW_GROUP_FALLBACK),
                        });
                      else set(use.key, { kind: 'existing', categoryId: v });
                    }}
                  >
                    <option value="">Uncategorised</option>
                    <option value="__new">Create “{use.name}” as new</option>
                    {groups.map((g) => (
                      <optgroup key={g.id} label={g.name}>
                        {g.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {choice.kind === 'new' ? (
                    <select
                      aria-label={`Group for ${label}`}
                      className={selectClass}
                      value={choice.group}
                      onChange={(e) => set(use.key, { kind: 'new', group: e.target.value })}
                    >
                      {expenseGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                      {newGroups.map((name) => (
                        <option key={name} value={newGroup(name)}>
                          New group “{name}”
                        </option>
                      ))}
                      {choice.group.startsWith('new:') &&
                        !newGroups.includes(choice.group.slice(4)) && (
                          <option value={choice.group}>New group “{choice.group.slice(4)}”</option>
                        )}
                    </select>
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { createCategory, createGroup } from '../../api/categories';
import { fileCategoryKey, type FileCategory } from '../../utils/csv';
import { matchCategory } from '../../utils/categoryMatch';
import type { ImportRow } from '../../api/transactions';
import type { CategoryGroup } from '../../types';
import { Combobox } from '../ui/Combobox';
import { CategorySelectButton } from './CategorySelectButton';

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

/** The mapping's "Create … as new" item: the category is made only when the import runs */
const NEW_CATEGORY = '__new';
const newGroupLabel = (name: string) => `New group “${name}”`;

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
    // No scroll box of its own: the category list opens inside the table, and the dialog scrolls
    <div className="border border-border rounded-lg">
      <table className="w-full table-fixed text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-1/3 rounded-tl-lg bg-surface-alt px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
              In your file
            </th>
            <th className="rounded-tr-lg bg-surface-alt px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
              In Allotment
            </th>
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
                {/* A third of a fixed table: a long one-word name wraps instead of running on */}
                <td className="px-2 py-1.5 text-xs text-text [overflow-wrap:anywhere]">
                  {label}
                  <span className="text-text-tertiary"> · {use.count}</span>
                </td>
                <td className="px-2 py-1.5 space-y-1">
                  <CategorySelectButton
                    label={`Category for ${label}`}
                    groups={groups}
                    value={
                      choice.kind === 'existing'
                        ? choice.categoryId
                        : choice.kind === 'new'
                          ? NEW_CATEGORY
                          : null
                    }
                    onChange={(v) => {
                      if (v === null) set(use.key, { kind: 'none' });
                      else if (v === NEW_CATEGORY)
                        set(use.key, {
                          kind: 'new',
                          group:
                            expenseGroups.find(
                              (g) => g.name.toLowerCase() === (use.group ?? '').toLowerCase(),
                            )?.id ?? newGroup(use.group ?? NEW_GROUP_FALLBACK),
                        });
                      else set(use.key, { kind: 'existing', categoryId: v });
                    }}
                    allowNone
                    noneLabel="Uncategorised"
                    extraItem={{ value: NEW_CATEGORY, label: `Create “${use.name}” as new` }}
                    // Nothing is created before the import runs: no create form in the list
                    allowCreate={false}
                    // Every category was offered before, hidden ones too, for older history
                    includeHidden
                  />
                  {/* A new category's group, under it: three columns do not fit a phone */}
                  {choice.kind === 'new' && (
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="shrink-0 text-xs text-text-tertiary">
                        in
                      </span>
                      <Combobox
                        aria-label={`Group for ${label}`}
                        fieldSize="sm"
                        className="min-w-0 flex-1"
                        // A click shows the list, as the select it replaces did
                        menuTrigger="focus"
                        value={choice.group}
                        onChange={(v) => {
                          // Emptying the text is not a choice: the group stays as it was
                          if (v) set(use.key, { kind: 'new', group: v });
                        }}
                        items={[
                          ...expenseGroups.map((g) => ({ value: g.id, label: g.name })),
                          ...newGroups.map((name) => ({
                            value: newGroup(name),
                            label: newGroupLabel(name),
                          })),
                          ...(choice.group.startsWith('new:') &&
                          !newGroups.includes(choice.group.slice(4))
                            ? [{ value: choice.group, label: newGroupLabel(choice.group.slice(4)) }]
                            : []),
                        ]}
                      />
                    </div>
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

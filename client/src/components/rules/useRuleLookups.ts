import { useMemo } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useTags } from '../../hooks/useTags';
import { useQuery } from '@tanstack/react-query';
import { getHouseholds } from '../../api/households';
import { usePreferencesStore } from '../../store/preferencesStore';
import type { RuleLookups } from '../../utils/ruleFormat';
import type { CategoryGroup } from '../../types';
import type { PickerOption } from './OptionPicker';

/** Names and picker options for the payees, accounts, categories and tags rules refer to */
export function useRuleLookups() {
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const { data: households = [] } = useQuery({ queryKey: ['households'], queryFn: getHouseholds });
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);

  return useMemo(() => {
    const payeeOptions: PickerOption[] = [...payees]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, label: p.name }));
    const accountOptions: PickerOption[] = accounts.map((a) => ({ id: a.id, label: a.name }));
    const categoryOptions: PickerOption[] = (groups as CategoryGroup[]).flatMap((g) =>
      g.categories.map((c) => ({
        id: c.id,
        group: g.name,
        label: `${showCategoryIcons && c.icon ? `${c.icon} ` : ''}${c.name}`,
      })),
    );

    const names = (opts: PickerOption[]) => new Map(opts.map((o) => [o.id, o.label]));
    const payeeNames = names(payeeOptions);
    const accountNames = names(accountOptions);
    const categoryNames = names(categoryOptions);
    const tagOptions: PickerOption[] = tags.map((t) => ({ id: t.id, label: t.name }));
    const tagNames = names(tagOptions);
    const lookups: RuleLookups = {
      payee: (id) => payeeNames.get(id),
      account: (id) => accountNames.get(id),
      category: (id) => categoryNames.get(id),
      tag: (id) => tagNames.get(id),
      household: (id) => households.find((h) => h.id === id)?.name,
    };
    const householdOptions = households.map((h) => ({ id: h.id, label: h.name }));
    return { lookups, payeeOptions, accountOptions, categoryOptions, tagOptions, householdOptions };
  }, [payees, accounts, groups, tags, households, showCategoryIcons]);
}

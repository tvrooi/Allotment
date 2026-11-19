// The options of a Select or a Combobox list, drawn once for both (02-REVIEW WR-04): a change to
// how an option or a group heading looks is made here, so the two lists cannot drift apart.
import { Check } from 'lucide-react';
import { Header, ListBoxItem, ListBoxSection } from 'react-aria-components';
import { optionClass } from './fieldClasses';
import type { SelectGroup, SelectOption } from './Select';

/** Whether an item is a headed group of options rather than one option */
export const isGroup = (item: SelectOption | SelectGroup): item is SelectGroup => 'options' in item;

/** One option: its label cut off with an ellipsis when long, and a tick while chosen */
function OptionItem({ option }: { option: SelectOption }) {
  return (
    <ListBoxItem
      id={option.value}
      textValue={option.label}
      isDisabled={option.isDisabled}
      className={optionClass}
    >
      {({ isSelected }) => (
        <>
          <span className="min-w-0 truncate">{option.label}</span>
          {isSelected && <Check size={16} aria-hidden="true" className="shrink-0" />}
        </>
      )}
    </ListBoxItem>
  );
}

/** A ListBox's children: flat options and headed groups, in the order given */
export function listItems(items: readonly (SelectOption | SelectGroup)[]) {
  return items.map((item) =>
    isGroup(item) ? (
      <ListBoxSection key={`group:${item.label}`} id={`group:${item.label}`}>
        <Header className="px-3 pt-2 pb-1 text-xs font-medium text-text-tertiary">
          {item.label}
        </Header>
        {item.options.map((option) => (
          <OptionItem key={option.value} option={option} />
        ))}
      </ListBoxSection>
    ) : (
      <OptionItem key={item.value} option={item} />
    ),
  );
}

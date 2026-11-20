// The options of a Select or a Combobox list, drawn once for both (02-REVIEW WR-04): a change to
// how an option or a group heading looks is made here, so the two lists cannot drift apart.
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Header, ListBoxItem, ListBoxSection } from 'react-aria-components';
import { optionClass } from './fieldClasses';
import type { SelectOption } from './Select';

/** An option in a Select or Combobox list, with optional leading icon and trailing metadata */
export type ListOption = SelectOption & { icon?: ReactNode; trailing?: ReactNode };
/** A headed group of ListOptions */
export type ListGroup = { label: string; options: readonly ListOption[] };

/** Whether an item is a headed group of options rather than one option */
export const isGroup = <T extends ListOption | ListGroup>(item: T): item is Extract<T, ListGroup> =>
  'options' in item;

/** One option: its label cut off with an ellipsis when long, and a tick while chosen */
function OptionItem({ option }: { option: ListOption }) {
  return (
    <ListBoxItem
      id={option.value}
      textValue={option.label}
      isDisabled={option.isDisabled}
      className={optionClass}
    >
      {({ isSelected }) => (
        <>
          {option.icon ? (
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              {option.icon}
              <span className="min-w-0 truncate">{option.label}</span>
            </span>
          ) : (
            <span className="min-w-0 truncate">{option.label}</span>
          )}
          {option.trailing}
          {isSelected && <Check size={16} aria-hidden="true" className="shrink-0" />}
        </>
      )}
    </ListBoxItem>
  );
}

/** A ListBox's children: flat options and headed groups, in the order given */
export function listItems(items: readonly (ListOption | ListGroup)[]) {
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

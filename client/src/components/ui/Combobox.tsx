import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Dialog,
  Group,
  Input as AriaInput,
  ListBox,
  Popover,
  useFilter,
} from 'react-aria-components';
import { FieldDescription, FieldErrorText } from './Field';
import {
  fieldBase,
  fieldHeights,
  fieldStates,
  listClass,
  optionClass,
  pickerIconButton,
  popoverClass,
} from './fieldClasses';
import { errorLine, fieldSubject, namesOf, present, type LabelNames } from './fieldMessages';
import { Label } from './Label';
import { listItems, type ListGroup, type ListOption } from './listItems';

type Props = LabelNames & {
  /** Flat options, headed groups, or both, in the order given (the Select's option shapes) */
  items: readonly (ListOption | ListGroup)[];
  /** The chosen option's value, or '' for none */
  value: string;
  /** An option's own value, or '' when the field is emptied */
  onChange: (value: string) => void;
  /** The field's text, for a caller that owns it; React Aria keeps it otherwise */
  inputValue?: string;
  onInputChange?: (text: string) => void;
  /** Text that matches no option stays in the field on blur; otherwise it returns to the label */
  allowsCustomValue?: boolean;
  /** 'input' opens the list on typing (and the chevron); 'focus' also opens it on focus */
  menuTrigger?: 'input' | 'focus';
  /**
   * How typing narrows the options: by default a contains match ignoring letter case; a
   * function of the option's label and the text; or false for a caller that passes the
   * already-narrowed items itself
   */
  filter?: false | ((label: string, text: string) => boolean);
  /** Offers a Clear button while there is a value (or caller-owned text) */
  optional?: boolean;
  /** Replaces the "No matching options" lines; null shows nothing and lets an empty list close */
  emptyState?: ReactNode;
  /** Shown below the list inside the popover, even when the list is empty */
  footer?: ReactNode;
  /** Added to the input, for a wrapper that needs its own text size */
  inputClassName?: string;
  /**
   * Replaces the field's box and its buttons (the chevron, and Clear, so it does not combine
   * with `optional`): the input alone takes these classes, for a
   * wrapper that keeps an existing screen's own field look (PayeeCombobox in the register row,
   * the detail panel and the phone sheet)
   */
  fieldClassName?: string;
  /** Added to the popover, for a wrapper that fixes its width */
  popoverClassName?: string;
  /**
   * Where the popover is drawn instead of the end of the page: an element in the caller's own
   * markup, so the list and footer stay inside the dialog or form it opened from
   */
  portalContainer?: Element;
  placeholder?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  /** Names the subject of the Clear button and the default required line instead of the label */
  errorLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Focusable and announced, but the text cannot be typed and the list does not open */
  isReadOnly?: boolean;
  isRequired?: boolean;
  /** md (40 px) beside a md Button, sm (32 px) beside a sm one; 44 px on phones either way */
  fieldSize?: keyof typeof fieldHeights;
  /** Added to the field's outer box; full width unless the caller gives its own */
  className?: string;
  id?: string;
};

/** The focused field's ring on the group, which holds the input and its buttons */
const groupFocus =
  'focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 data-[invalid]:focus-within:border-negative data-[invalid]:focus-within:ring-negative';

/** A Combobox's icon button: the picker's, with a 44 px target on phones */
const iconButton = `${pickerIconButton} max-md:min-h-11 max-md:min-w-11`;

/** The empty list's lines (02-UI-SPEC.md, Copywriting Contract) */
function NoMatches() {
  return (
    <div className="px-3 py-2">
      <p className="text-sm text-text">No matching options</p>
      <p className="text-xs text-text-tertiary">
        Type a different search term or clear the filter to see all choices.
      </p>
    </div>
  );
}

/**
 * The shared Combobox (02-UI-SPEC.md, per-control item 6; D-06): a text field with a listbox
 * popover for user-grown lists, on React Aria's ComboBox at every width. Typing filters the
 * options (letter case ignored), the arrows move through them, Enter chooses the highlighted
 * one and Escape closes only the list, never a dialog or sheet around it (D-12); focus stays
 * in the field throughout. A single option is
 * never chosen for the person.
 */
export function Combobox(props: Props) {
  const {
    items,
    value,
    onChange,
    inputValue,
    onInputChange,
    allowsCustomValue = false,
    menuTrigger = 'input',
    filter,
    optional = false,
    emptyState,
    footer,
    inputClassName = '',
    fieldClassName,
    popoverClassName = '',
    portalContainer,
    placeholder,
    description,
    errorMessage,
    isDisabled = false,
    isInvalid = false,
    isReadOnly = false,
    isRequired = false,
    fieldSize = 'md',
    className = 'w-full',
    id,
  } = props;
  const { contains } = useFilter({ sensitivity: 'base' });
  const inputRef = useRef<HTMLInputElement>(null);
  // D-12: whether the list was open when a key came in, read before React Aria handles the key
  const isOpen = useRef(false);
  const wasOpen = useRef(false);
  const names = namesOf(props);
  const subject = fieldSubject(names);
  const error = errorLine(errorMessage, { isRequired, kind: 'choice', names });
  const canClear =
    optional && !isDisabled && !isReadOnly && (value !== '' || (inputValue ?? '') !== '');
  const ownField = fieldClassName !== undefined;
  const clear = () => {
    onChange('');
    onInputChange?.('');
    inputRef.current?.focus();
  };

  return (
    <AriaComboBox
      id={id}
      aria-label={props['aria-label']}
      selectedKey={value === '' ? null : value}
      onSelectionChange={(key) => onChange(key == null ? '' : String(key))}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onOpenChange={(open) => {
        isOpen.current = open;
      }}
      defaultFilter={filter === false ? () => true : (filter ?? contains)}
      allowsCustomValue={allowsCustomValue}
      menuTrigger={menuTrigger}
      // The empty lines and the footer show in an open, empty list
      allowsEmptyCollection={emptyState !== null || footer != null}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      validationBehavior="aria"
      className={`flex flex-col gap-1 ${className}`}
    >
      {props.label !== undefined && <Label isRequired={isRequired}>{props.label}</Label>}
      <Group
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        isReadOnly={isReadOnly}
        className={
          ownField
            ? 'w-full'
            : `${fieldBase} ${fieldHeights[fieldSize]} ${fieldStates} ${groupFocus} w-full`
        }
      >
        <span className={`flex min-w-0 items-center gap-1 ${ownField ? '' : 'h-full'}`}>
          <AriaInput
            ref={inputRef}
            onKeyDownCapture={() => {
              wasOpen.current = isOpen.current;
            }}
            // D-12: Escape that closed the list is marked handled, so a dialog or sheet around
            // the field (Modal.tsx closes unless the event was handled) stays open; with the
            // list closed, Escape is left to it
            onKeyDown={(e) => {
              if (e.key === 'Escape' && wasOpen.current) e.preventDefault();
            }}
            placeholder={placeholder}
            className={
              ownField
                ? `min-w-0 flex-1 ${fieldClassName}`
                : `h-full min-w-0 flex-1 truncate bg-transparent outline-none cursor-[inherit] placeholder:text-text-tertiary ${inputClassName}`
            }
          />
          {/* -mr-2 sets the buttons 4 px from the border, as the pickers' are */}
          {!ownField && (
            <span className="-mr-2 flex shrink-0 items-center">
              {canClear && (
                <AriaButton
                  aria-label={`Clear ${subject}`}
                  // Not the ComboBox's trigger slot: it empties the field instead of opening the list
                  slot={null}
                  onPress={clear}
                  className={iconButton}
                >
                  <X size={14} aria-hidden="true" />
                </AriaButton>
              )}
              <AriaButton className={iconButton}>
                <ChevronDown size={16} aria-hidden="true" />
              </AriaButton>
            </span>
          )}
        </span>
      </Group>
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {present(error) && <FieldErrorText>{error}</FieldErrorText>}
      <Popover
        offset={4}
        UNSTABLE_portalContainer={portalContainer}
        className={`${popoverClass} ${popoverClassName}`}
      >
        <ListBox
          className={listClass}
          renderEmptyState={() => (emptyState === undefined ? <NoMatches /> : emptyState)}
        >
          {listItems(items)}
        </ListBox>
        {footer != null && <div className="border-t border-border-light">{footer}</div>}
      </Popover>
    </AriaComboBox>
  );
}

/** One choice in a SearchList: the shared list option shape without trailing metadata */
export type SearchListOption = Omit<ListOption, 'trailing'>;

/** A run of SearchList choices, under a heading when it has one */
export type SearchListSection = { id: string; heading?: string; options: SearchListOption[] };

/** The row a SearchList shows above its sections, such as "Uncategorised" */
export type SearchListPinned = {
  label: string;
  /** Shows the tick, as a chosen option does */
  isSelected: boolean;
  onPick: () => void;
  /** Whether the arrow keys reach it (first in their order); a click always does */
  inKeyboardOrder: boolean;
};

type SearchListBodyProps = {
  /** The search field's accessible name; it also names the list */
  searchLabel: string;
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** Already filtered by the caller, in the order to show; SearchList does no matching itself */
  sections: readonly SearchListSection[];
  /** The chosen option's value, or null */
  value: string | null;
  onPick: (value: string) => void;
  pinned?: SearchListPinned;
  /** Shown when no section has an option, whether or not the pinned row shows */
  emptyText: ReactNode;
  /** Below the list, outside it: a create form or a link */
  footer?: ReactNode;
  onClose: () => void;
  /**
   * Whether the search field takes focus when the list opens (default true). A caller can let it
   * wait for a tap, so the phone keyboard does not open by itself (owner, 21 November 2026, UAT
   * G-03-1); focus then rests on the listbox, whose keys are the same.
   */
  focusSearchOnOpen?: boolean;
};

type SearchListProps = SearchListBodyProps & {
  /** The element the list is placed against; focus returns to it on close */
  triggerRef: RefObject<Element | null>;
  placement?: 'bottom start' | 'top start';
  /** 'trigger' is at least the trigger's width; otherwise a width class such as w-64 */
  width?: 'trigger' | string;
  /**
   * The least gap, in px, between the list and the edge of the container it is drawn in (React
   * Aria's default is 12). A list drawn into `portalContainer` that must sit flush with its
   * trigger sets 0, or it is pushed 12 px in from the container's left edge.
   */
  containerPadding?: number;
  /** Added to the popover */
  className?: string;
  /**
   * Where the popover is drawn instead of the end of the page: an element in the caller's own
   * markup, so the list stays inside the dialog, row or form it opened from
   */
  portalContainer?: Element;
};

type Row = { id: string; pick: () => void };

/**
 * SearchList's contents without its popover: the search field over the sectioned listbox, and
 * the keyboard rules. Exported for its unit test, since React Aria draws no popover on the server.
 *
 * The list is a plain ARIA listbox with the field's aria-activedescendant, not React Aria's
 * Autocomplete: Autocomplete highlights the first option only after typed text (not a fill or
 * a deletion) and would highlight the pinned row while searching, and both rules are the picker's
 * (T-02-24). The keyboard order: the pinned row first when it is in it, then every enabled option.
 * The search field takes focus on open unless the caller sets `focusSearchOnOpen` to false (a
 * caller can let it wait for a tap, so the phone keyboard does not open by itself, owner,
 * 21 November 2026, UAT G-03-1); focus then rests on the listbox, which handles the same keys.
 */
export function SearchListBody({
  searchLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  sections,
  value,
  onPick,
  pinned,
  emptyText,
  footer,
  onClose,
  focusSearchOnOpen = true,
}: SearchListBodyProps) {
  const baseId = useId();
  // Where the arrow keys moved to, for the search it was moved under. A new search starts over:
  // on its first match when there is text, on nothing when there is none, so Enter alone never
  // picks a choice the person did not see highlighted.
  const [moved, setMoved] = useState<{ query: string; index: number } | null>(null);

  const rowId = (key: string) => `${baseId}-${key}`;
  const order: Row[] = [
    ...(pinned?.inKeyboardOrder ? [{ id: rowId('pinned'), pick: pinned.onPick }] : []),
    ...sections.flatMap((section, s) =>
      section.options
        .filter((o) => !o.isDisabled)
        .map((o) => ({ id: rowId(`${s}-${o.value}`), pick: () => onPick(o.value) })),
    ),
  ];
  const wanted = moved && moved.query === query ? moved.index : query ? 0 : -1;
  const activeIndex = Math.min(wanted, order.length - 1);
  const activeId = activeIndex >= 0 ? order[activeIndex].id : undefined;
  const isEmpty = sections.every((section) => section.options.length === 0);
  // What a click on each enabled row picks, the pinned row included even when the keys skip it
  const picks = new Map<string, () => void>();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Read once, on open: the list's focus does not follow a later change of the prop
  const focusSearch = useRef(focusSearchOnOpen);

  useEffect(() => {
    (focusSearch.current ? searchRef : listRef).current?.focus();
  }, []);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      // Closes the list only: handled here, so neither the popover nor a dialog or sheet
      // behind it (Modal.tsx closes unless the event was handled) sees it
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMoved({ query, index: Math.min(order.length - 1, activeIndex + 1) });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMoved({ query, index: Math.max(0, activeIndex - 1) });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      order[activeIndex].pick();
    }
  }

  const option = (
    id: string,
    label: ReactNode,
    isSelected: boolean,
    pick: (() => void) | null,
    icon?: ReactNode,
  ) => {
    if (pick) picks.set(id, pick);
    return (
      <div
        key={id}
        id={id}
        role="option"
        aria-selected={isSelected}
        aria-disabled={pick ? undefined : true}
        data-focused={id === activeId || undefined}
        // The category picker's own mark for its highlighted row, which specs read
        data-active={id === activeId}
        // The highlight only ever moves by key, so it takes the keyboard ring
        data-focus-visible={id === activeId || undefined}
        data-selected={isSelected || undefined}
        data-disabled={pick ? undefined : true}
        className={optionClass}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {icon}
          <span className="min-w-0 truncate">{label}</span>
        </span>
        {isSelected && <Check size={16} aria-hidden="true" className="shrink-0" />}
      </div>
    );
  };

  return (
    <>
      <div className="shrink-0 border-b border-border-light p-2">
        <div className="relative">
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={searchLabel}
            aria-controls={rowId('list')}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            placeholder={searchPlaceholder}
            className={`${fieldBase} ${fieldHeights.sm} w-full pl-8`}
          />
        </div>
      </div>
      <div className={`${listClass} min-h-0`}>
        {/* The keys stay in the search field (aria-activedescendant), so the listbox takes
            clicks only: one handler for its rows, and no focus taken from the field */}
        <div
          ref={listRef}
          id={rowId('list')}
          role="listbox"
          aria-label={searchLabel}
          aria-activedescendant={activeId}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          // Should focus land on the list itself (focusSearchOnOpen false), its keys are the field's
          onKeyDown={onKeyDown}
          onClick={(e) => {
            const row = (e.target as Element).closest('[role="option"]');
            if (row) picks.get(row.id)?.();
          }}
        >
          {pinned &&
            option(
              rowId('pinned'),
              <span className="italic">{pinned.label}</span>,
              pinned.isSelected,
              pinned.onPick,
            )}
          {sections.map((section, s) =>
            section.options.length === 0 ? null : (
              <div
                key={section.id}
                role="group"
                aria-labelledby={section.heading ? rowId(`${s}-heading`) : undefined}
              >
                {section.heading && (
                  <div
                    id={rowId(`${s}-heading`)}
                    role="presentation"
                    className="bg-surface-alt px-3 py-1 text-xs font-medium text-text-tertiary"
                  >
                    {section.heading}
                  </div>
                )}
                {section.options.map((o) =>
                  option(
                    rowId(`${s}-${o.value}`),
                    o.label,
                    o.value === value,
                    o.isDisabled ? null : () => onPick(o.value),
                    o.icon,
                  ),
                )}
              </div>
            ),
          )}
        </div>
        {isEmpty && (
          <div className="px-3 py-4 text-center text-sm text-text-tertiary">{emptyText}</div>
        )}
      </div>
      {footer != null && (
        // Escape in the footer (a create form) closes only the list, as it does in the field:
        // marked handled, so a dialog or sheet behind it (Modal.tsx) stays open
        <div
          className="shrink-0 border-t border-border-light"
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
        >
          {footer}
        </div>
      )}
    </>
  );
}

/**
 * The shared searchable list (02-UI-SPEC.md, the CategoryPicker bullet; D-05): a popover placed
 * against `triggerRef` with a search text field (role textbox) over a sectioned listbox. The
 * caller owns the search and the filtering and renders it while it is open, unmounting it on
 * `onClose`. With a search typed its first option is highlighted, so Enter picks it; with none
 * typed nothing is, so Enter picks nothing. The arrows stop at the ends. Escape closes only the
 * list and focus returns to the trigger; a click outside closes it with no pick, and a click
 * inside never reaches what is behind it. The search takes focus on open unless `focusSearchOnOpen`
 * is false (so the phone keyboard does not open by itself, owner, 21 November 2026, UAT G-03-1).
 *
 * The popover is non-modal, as the hand-rolled category picker was: nothing behind it is made
 * inert, so a click outside goes on to the panel heading or row it was aimed at, and the list
 * closes on that press. A press counts as inside by the React tree, not the page, so a press in
 * a popover the list opened itself (its footer's Select) leaves it open.
 */
export function SearchList({
  triggerRef,
  placement = 'bottom start',
  width = 'trigger',
  containerPadding,
  className = '',
  portalContainer,
  onClose,
  searchLabel,
  ...body
}: SearchListProps) {
  // Set by the press while it passes through the list's React tree, which React handles before
  // the document hears it
  const pressedInside = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onPress = () => {
      if (!pressedInside.current) closeRef.current();
      pressedInside.current = false;
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, []);
  return (
    <Popover
      triggerRef={triggerRef}
      UNSTABLE_portalContainer={portalContainer}
      isOpen
      isNonModal
      placement={placement}
      offset={4}
      containerPadding={containerPadding}
      className={`${popoverClass} flex flex-col ${width === 'trigger' ? '' : width} ${className}`}
    >
      <Dialog
        aria-label={searchLabel}
        className="flex min-h-0 flex-col outline-none"
        // React events bubble through portals: a click in the list must not reach the trigger's
        // row or any other handler around the caller
        onClick={(e) => e.stopPropagation()}
        onPointerDown={() => {
          pressedInside.current = true;
        }}
      >
        <SearchListBody searchLabel={searchLabel} onClose={onClose} {...body} />
      </Dialog>
    </Popover>
  );
}

import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import {
  Button as AriaButton,
  ListBox,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from 'react-aria-components';
import { useIsPhone } from '../../hooks/useIsPhone';
import { describedByIds, FieldDescription, FieldErrorText, FieldLines } from './Field';
import { fieldBase, fieldHeights, fieldStates, listClass, popoverClass } from './fieldClasses';
import { errorLine, namesOf, present, SELECT_PLACEHOLDER, type LabelNames } from './fieldMessages';
import { Label } from './Label';
import { isGroup, listItems } from './listItems';

/** One choice: `value` is what onChange receives, `label` what the person reads */
export type SelectOption = { value: string; label: string; isDisabled?: boolean };
/** A headed group of choices (a native optgroup on phones) */
export type SelectGroup = { label: string; options: SelectOption[] };

type Props = LabelNames & {
  /** The chosen option's value, or '' for none */
  value: string;
  /** Always one of the options' own values, or '' only if the caller clears it */
  onChange: (value: string) => void;
  /** Flat options, headed groups, or both, shown in the order given */
  options: readonly (SelectOption | SelectGroup)[];
  /** What the unset field shows; "Select one" (SELECT_PLACEHOLDER) unless given */
  placeholder?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  /** Names the subject of the default required line instead of the label */
  errorLabel?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Focusable and announced, but it does not open and the value does not change */
  isReadOnly?: boolean;
  isRequired?: boolean;
  /** md (40 px) beside a md Button, sm (32 px) beside a sm one; 44 px on phones either way */
  fieldSize?: keyof typeof fieldHeights;
  /** Added to the field's outer box; full width unless the caller gives its own */
  className?: string;
  id?: string;
  name?: string;
};

/** Whether `value` is one of the options, so a stale or unknown value shows as unset */
const hasOption = (items: Props['options'], value: string) =>
  items.some((item) =>
    isGroup(item) ? item.options.some((o) => o.value === value) : item.value === value,
  );

/**
 * The shared Select (02-UI-SPEC.md, per-control item 5). On desktop it is React Aria's Select: a
 * button trigger with the field look, opening a listbox popover that follows the WAI-ARIA
 * listbox keyboard pattern (arrows, Enter or Space, Escape, typeahead). On phones (under 768 px,
 * D-04) it is a native select, so the phone's own picker opens. Both branches take and give the
 * option's value string, '' for none. A single option is never chosen for the person.
 */
export function Select(props: Props) {
  const {
    value,
    onChange,
    options,
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
    name,
  } = props;
  const isPhone = useIsPhone();
  const error = errorLine(errorMessage, { isRequired, kind: 'choice', names: namesOf(props) });

  if (isPhone)
    return <NativeSelect {...props} className={className} error={isInvalid ? error : undefined} />;

  return (
    <AriaSelect
      id={id}
      name={name}
      aria-label={props['aria-label']}
      value={value === '' ? null : value}
      // Read-only: the trigger still takes focus, but typeahead on it must not change the value
      onChange={(key) => {
        if (!isReadOnly) onChange(key == null ? '' : String(key));
      }}
      placeholder={placeholder ?? SELECT_PLACEHOLDER}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isRequired={isRequired}
      validationBehavior="aria"
      // Read-only never opens (02-RESEARCH.md, Open Question 3)
      isOpen={isReadOnly ? false : undefined}
      allowsEmptyCollection
      className={`flex flex-col gap-1 ${className}`}
    >
      {props.label !== undefined && (
        <Label elementType="span" isRequired={isRequired}>
          {props.label}
        </Label>
      )}
      <AriaButton
        data-invalid={isInvalid || undefined}
        // aria-readonly is not a button attribute (WAI-ARIA), so read-only is the data attribute
        // and the never-opening guard above; the phone's native select does carry aria-readonly
        data-readonly={isReadOnly || undefined}
        className={`${fieldBase} ${fieldHeights[fieldSize]} ${fieldStates} w-full text-left`}
      >
        <span className="flex h-full min-w-0 items-center justify-between gap-2">
          <SelectValue
            className={({ isPlaceholder }) =>
              `min-w-0 truncate ${isPlaceholder ? 'text-text-tertiary' : ''}`
            }
          />
          <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-text-tertiary" />
        </span>
      </AriaButton>
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {present(error) && <FieldErrorText>{error}</FieldErrorText>}
      <Popover offset={4} className={popoverClass}>
        <ListBox
          className={listClass}
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-text-tertiary">No matching options</p>
          )}
        >
          {listItems(options)}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

/**
 * The phone branch: a native select inside its label, so tapping either opens the phone's own
 * picker. Read-only disables every option but the chosen one, so the value cannot change while
 * the select stays focusable. Help and error lines are tied to it by id, as a Field ties them.
 */
function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  description,
  error,
  isDisabled,
  isInvalid,
  isReadOnly,
  isRequired,
  className,
  id,
  name,
  ...names
}: Props & { error: ReactNode }) {
  const lineId = useId();
  const chosen = hasOption(options, value) ? value : '';
  const option = (o: SelectOption) => (
    <option
      key={o.value}
      value={o.value}
      disabled={o.isDisabled || (isReadOnly && o.value !== chosen)}
    >
      {o.label}
    </option>
  );
  const select = (
    <select
      id={id}
      name={name}
      aria-label={names.label === undefined ? names['aria-label'] : undefined}
      aria-describedby={describedByIds(lineId, description, error)}
      value={chosen}
      onChange={(e) => {
        if (!isReadOnly) onChange(e.target.value);
      }}
      disabled={isDisabled}
      required={isRequired}
      aria-invalid={isInvalid || undefined}
      aria-readonly={isReadOnly || undefined}
      data-readonly={isReadOnly || undefined}
      className={`${fieldBase} ${fieldStates} w-full min-h-11 text-base ${chosen === '' ? 'text-text-tertiary' : ''}`}
    >
      {/* Unset shows the placeholder; it cannot be chosen back, as on desktop */}
      {(placeholder !== undefined || chosen === '') && (
        <option value="" disabled>
          {placeholder ?? SELECT_PLACEHOLDER}
        </option>
      )}
      {options.map((item) =>
        isGroup(item) ? (
          <optgroup key={`group:${item.label}`} label={item.label}>
            {item.options.map(option)}
          </optgroup>
        ) : (
          option(item)
        ),
      )}
    </select>
  );
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {names.label !== undefined ? (
        <label className="flex flex-col gap-1">
          <Label elementType="span" isRequired={isRequired}>
            {names.label}
          </Label>
          {select}
        </label>
      ) : (
        select
      )}
      <FieldLines id={lineId} description={description} error={error} />
    </div>
  );
}

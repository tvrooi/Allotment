import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { CheckboxButton, CheckboxField } from 'react-aria-components';
import { FieldDescription, FieldErrorText } from './Field';
import { toggleDisabled, toggleFocusRing, toggleInvalid, toggleReadOnly } from './fieldClasses';
import { fieldSubject, requiredMessage, toggleNames, type ToggleNames } from './fieldMessages';

type Props = ToggleNames & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Shows a dash: some of what this box stands for is on. Clicking it turns it all on */
  isIndeterminate?: boolean;
  disabled?: boolean;
  /** Focusable and announced, but the value does not change */
  readOnly?: boolean;
  isInvalid?: boolean;
  /** Help text under the box, tied to it by aria-describedby */
  description?: ReactNode;
  /** The error line while invalid; a required box defaults to "Turn on {subject} to continue" */
  errorMessage?: ReactNode;
  /** Added to the label, the target that holds the box and any visible text */
  className?: string;
};

/** Whether there is something to show: an absent part renders nothing, so it leaves no gap */
const present = (node: ReactNode) => node != null && node !== false && node !== '';

/**
 * The shared checkbox on React Aria's CheckboxField and CheckboxButton: a hidden native checkbox
 * inside the label this component draws itself, so a caller never wraps it in another label.
 * Disabled, read-only and invalid each have their own look (02-UI-SPEC.md, per-control item 7),
 * and a disabled box never shows the brand colour. The box's 1 px edge is an inset ring, so the
 * shared disabled, read-only and invalid toggle classes replace it without changing its size.
 * On phones the label is a 44 px target; its padding keeps the box level with the first line
 * of a label that wraps. Help text and the error line sit under it, each only when there is one.
 */
export function Checkbox(props: Props) {
  const {
    checked,
    onCheckedChange,
    isIndeterminate = false,
    disabled = false,
    readOnly = false,
    isInvalid = false,
    isRequired = false,
    description,
    className = '',
    children,
  } = props;
  const errorMessage =
    present(props.errorMessage) || !isRequired
      ? props.errorMessage
      : requiredMessage('toggle', fieldSubject(toggleNames(props)));
  const showError = isInvalid && present(errorMessage);
  const lines = present(description) || showError;
  const marked = checked || isIndeterminate;

  const fill = disabled
    ? `${toggleDisabled} text-text-disabled`
    : readOnly
      ? marked
        ? 'bg-text-secondary text-surface cursor-default'
        : toggleReadOnly
      : `${marked ? 'bg-brand-600 text-brand-contrast' : 'bg-surface'} ${isInvalid ? toggleInvalid : marked ? '' : 'ring-1 ring-inset ring-text-tertiary'}`;
  const cursor = disabled ? 'cursor-not-allowed' : readOnly ? 'cursor-default' : 'cursor-pointer';
  const Mark = isIndeterminate ? Minus : checked ? Check : null;
  return (
    <CheckboxField
      isSelected={checked}
      onChange={onCheckedChange}
      isIndeterminate={isIndeterminate}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={isInvalid}
      isRequired={isRequired}
      aria-label={props['aria-label']}
      className={lines ? 'flex flex-col items-start gap-1' : 'contents'}
    >
      {/* relative: React Aria's hidden input is absolutely placed; without a positioned label it
          sits against the page and makes the whole document taller (the phone welcome screen) */}
      <CheckboxButton
        className={`group relative inline-flex items-start gap-2 text-sm ${disabled ? 'text-text-disabled' : 'text-text'} max-md:min-h-11 max-md:min-w-11 max-md:py-3 [&_input]:outline-none ${children != null ? '' : 'justify-center'} ${cursor} ${className}`}
      >
        <span
          aria-hidden="true"
          className={`flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors motion-reduce:transition-none ${fill} ${toggleFocusRing}`}
        >
          {Mark && <Mark size={14} strokeWidth={3} />}
        </span>
        {children != null && <span className="min-w-0 break-words">{children}</span>}
      </CheckboxButton>
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {showError && <FieldErrorText>{errorMessage}</FieldErrorText>}
    </CheckboxField>
  );
}

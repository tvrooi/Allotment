import type { ReactNode } from 'react';
import { SwitchButton, SwitchField } from 'react-aria-components';
import { FieldDescription, FieldErrorText } from './Field';
import { toggleDisabled, toggleFocusRing, toggleInvalid, toggleReadOnly } from './fieldClasses';
import { fieldSubject, requiredMessage, toggleNames, type ToggleNames } from './fieldMessages';

type Common = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Focusable and announced, but the value does not change */
  readOnly?: boolean;
  isInvalid?: boolean;
  /** Added to the label, the 44 px target that holds the track and any visible text */
  className?: string;
  /** Which side of the track a visible label sits on */
  labelSide?: 'start' | 'end';
  /** Help text under the switch, tied to it by aria-describedby */
  description?: ReactNode;
  /** The error line while invalid; a required switch defaults to "Turn on {subject} to continue" */
  errorMessage?: ReactNode;
};

/**
 * A visible label, an aria-label, or both: a switch is never left unnamed. A required switch
 * whose only name is a React node passes `errorLabel` for its default line (ToggleNames).
 */
type Props = Common & ToggleNames;

/** Whether there is something to show: an absent part renders nothing, so it leaves no gap */
const present = (node: ReactNode) => node != null && node !== false && node !== '';

const track =
  'relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none';
const thumb =
  'absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none';

/**
 * The shared on/off switch on React Aria's SwitchField and SwitchButton: a hidden checkbox with
 * role switch inside a label, toggled by click, tap or Space. Disabled, read-only and invalid
 * each have their own look (02-UI-SPEC.md, per-control item 9); a disabled switch never shows the
 * brand colour, and its thumb still shows whether it is on (#264). Help text and the error line
 * sit under it, each only when there is one; without either, the field adds no box of its own.
 */
export function Switch(props: Props) {
  const {
    checked,
    onCheckedChange,
    disabled = false,
    readOnly = false,
    isInvalid = false,
    isRequired = false,
    description,
    className = '',
    labelSide = 'end',
    children,
    'aria-label': ariaLabel,
  } = props;
  const errorMessage =
    present(props.errorMessage) || !isRequired
      ? props.errorMessage
      : requiredMessage('toggle', fieldSubject(toggleNames(props)));
  const showError = isInvalid && present(errorMessage);
  const lines = present(description) || showError;
  const fill = disabled
    ? toggleDisabled
    : readOnly
      ? checked
        ? 'bg-text-secondary cursor-default'
        : toggleReadOnly
      : `${checked ? 'bg-brand-600' : 'bg-text-tertiary'} ${isInvalid ? toggleInvalid : ''}`;
  const knob = disabled
    ? 'bg-text-disabled'
    : readOnly
      ? checked
        ? 'bg-surface'
        : 'bg-text-secondary'
      : checked
        ? 'bg-brand-contrast'
        : 'bg-surface';
  const cursor = disabled ? 'cursor-not-allowed' : readOnly ? 'cursor-default' : 'cursor-pointer';
  const label = children != null ? <span className="min-w-0">{children}</span> : null;
  return (
    <SwitchField
      isSelected={checked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={isInvalid}
      isRequired={isRequired}
      aria-label={ariaLabel}
      className={lines ? 'flex flex-col items-start gap-1' : 'contents'}
    >
      {/* relative: React Aria's hidden input is absolutely placed; without a positioned label it
          sits against the page and makes the whole document taller (the phone welcome screen) */}
      <SwitchButton
        className={`group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&_input]:outline-none ${label ? '' : 'justify-center'} ${cursor} ${className}`}
      >
        {labelSide === 'start' && label}
        <span aria-hidden="true" className={`${track} ${fill} ${toggleFocusRing}`}>
          <span className={`${thumb} ${knob} ${checked ? 'translate-x-4' : ''}`} />
        </span>
        {labelSide === 'end' && label}
      </SwitchButton>
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {showError && <FieldErrorText>{errorMessage}</FieldErrorText>}
    </SwitchField>
  );
}

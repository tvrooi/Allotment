import type { ReactNode } from 'react';
import { RadioButton, RadioField, RadioGroup as AriaRadioGroup } from 'react-aria-components';
import { FieldDescription, FieldErrorText } from './Field';
import { toggleDisabled, toggleFocusRing, toggleInvalid, toggleReadOnly } from './fieldClasses';
import { fieldSubject, requiredMessage, type FieldNames } from './fieldMessages';
import { Label } from './Label';

/** A visible label, or an aria-label when there is none: a group is never left unnamed */
type Names = { label: string; 'aria-label'?: string } | { label?: undefined; 'aria-label': string };

type Props = Names & {
  /** The chosen Radio's value, or '' for none */
  value: string;
  onChange: (value: string) => void;
  /** Vertical (8 px apart) by default; horizontal wraps, 16 px apart */
  orientation?: 'vertical' | 'horizontal';
  isDisabled?: boolean;
  /** Focusable and announced, but the choice does not change */
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  /** Help text under the group, tied to it by aria-describedby */
  description?: ReactNode;
  /** The error line while invalid; a required group defaults to "Select {subject} to continue" */
  errorMessage?: ReactNode;
  /** Names the subject of the default required line instead of the label */
  errorLabel?: string;
  className?: string;
  /** The Radio options, in the order the arrow keys move through them */
  children: ReactNode;
};

/** Whether there is something to show: an absent part renders nothing, so it leaves no gap */
const present = (node: ReactNode) => node != null && node !== false && node !== '';

/**
 * The shared radio group on React Aria's RadioGroup: one choice from a short list, moved and
 * chosen with the arrow keys (WAI-ARIA radio group), one Tab stop for the whole group. Its label
 * is a span, because a group is not labelable (`strayLabels`). Help text and the error line sit
 * under the options, each only when there is one, and describe the group.
 */
export function RadioGroup(props: Props) {
  const {
    value,
    onChange,
    orientation = 'vertical',
    isDisabled = false,
    isReadOnly = false,
    isInvalid = false,
    isRequired = false,
    description,
    errorLabel,
    className = '',
    children,
  } = props;
  const names: FieldNames =
    props.label !== undefined
      ? { errorLabel, label: props.label }
      : { errorLabel, ariaLabel: props['aria-label'] };
  const errorMessage =
    present(props.errorMessage) || !isRequired
      ? props.errorMessage
      : requiredMessage('choice', fieldSubject(names));
  return (
    <AriaRadioGroup
      // React Aria treats '' as a chosen value of its own; null is none
      value={value === '' ? null : value}
      onChange={onChange}
      orientation={orientation}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isInvalid={isInvalid}
      isRequired={isRequired}
      aria-label={props['aria-label']}
      className={`flex flex-col items-start gap-1 ${className}`}
    >
      {props.label !== undefined && (
        <Label elementType="span" isRequired={isRequired}>
          {props.label}
        </Label>
      )}
      <div
        className={
          orientation === 'horizontal' ? 'flex flex-wrap gap-x-4 gap-y-2' : 'flex flex-col gap-2'
        }
      >
        {children}
      </div>
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && present(errorMessage) && <FieldErrorText>{errorMessage}</FieldErrorText>}
    </AriaRadioGroup>
  );
}

/** A visible label, or an aria-label when there is none */
type RadioProps = { value: string; isDisabled?: boolean } & (
  | { children: NonNullable<ReactNode>; 'aria-label'?: string }
  | { children?: undefined; 'aria-label': string }
);

/**
 * One choice in a RadioGroup: a hidden native radio inside the label this draws, so a caller
 * never wraps it in another label. Its looks match the Checkbox's (02-UI-SPEC.md, per-control
 * item 8): a disabled one never shows the brand colour, a read-only one shows its choice in
 * text-secondary, and each is a 44 px target on phones with the circle level with the first line.
 */
export function Radio({ value, isDisabled, children, 'aria-label': ariaLabel }: RadioProps) {
  return (
    <RadioField value={value} isDisabled={isDisabled} aria-label={ariaLabel} className="contents">
      {/* relative: React Aria's hidden input is absolutely placed; without a positioned label it
          sits against the page and makes the whole document taller (the phone welcome screen) */}
      <RadioButton
        className={({ isDisabled: disabled, isReadOnly: readOnly }) =>
          `group relative inline-flex items-start gap-2 text-sm max-md:min-h-11 max-md:min-w-11 max-md:py-3 [&_input]:outline-none ${children != null ? '' : 'justify-center'} ${disabled ? 'text-text-disabled cursor-not-allowed' : `text-text ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}`
        }
      >
        {({ isSelected, isDisabled: disabled, isReadOnly: readOnly, isInvalid }) => {
          const ring = disabled
            ? toggleDisabled
            : readOnly
              ? toggleReadOnly
              : `bg-surface ${isInvalid ? toggleInvalid : `ring-1 ring-inset ${isSelected ? 'ring-brand-600' : 'ring-text-tertiary'}`}`;
          const dot = disabled
            ? 'bg-text-disabled'
            : readOnly
              ? 'bg-text-secondary'
              : 'bg-brand-600';
          return (
            <>
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${ring} ${toggleFocusRing}`}
              >
                {isSelected && <span className={`size-2 rounded-full ${dot}`} />}
              </span>
              {children != null && <span className="min-w-0 break-words">{children}</span>}
            </>
          );
        }}
      </RadioButton>
    </RadioField>
  );
}

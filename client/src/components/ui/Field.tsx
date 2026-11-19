import type { ReactNode } from 'react';
import { FieldError, Text, TextField } from 'react-aria-components';
import { errorClass, helpClass } from './fieldClasses';
import { errorLine, present } from './fieldMessages';
import { Label } from './Label';

/** Help text under a control, tied to it through aria-describedby by the surrounding field */
export function FieldDescription({ children }: { children: ReactNode }) {
  return (
    <Text slot="description" className={`${helpClass} break-words`}>
      {children}
    </Text>
  );
}

/** The error line under a control; it shows only while the surrounding field is invalid */
export function FieldErrorText({ children }: { children: ReactNode }) {
  return <FieldError className={`${errorClass} break-words`}>{children}</FieldError>;
}

/**
 * The aria-describedby of a hand-built field (a native or month-grid branch, outside a React Aria
 * field): the ids FieldLines gives its help and error lines, for whichever there is
 */
export function describedByIds(
  id: string,
  description: ReactNode,
  error: ReactNode,
): string | undefined {
  const ids = [
    present(description) ? `${id}-description` : '',
    present(error) ? `${id}-error` : '',
  ].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/**
 * A hand-built field's help line and error line, each only when there is one, with the ids
 * describedByIds names: FieldDescription and FieldErrorText for a control outside React Aria's
 * fields. `error` is given only while the control is invalid.
 */
export function FieldLines({
  id,
  description,
  error,
}: {
  id: string;
  description: ReactNode;
  error: ReactNode;
}) {
  return (
    <>
      {present(description) && (
        <p id={`${id}-description`} className={`${helpClass} break-words`}>
          {description}
        </p>
      )}
      {present(error) && (
        <p id={`${id}-error`} className={`${errorClass} break-words`}>
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Required: a Field always names its control with a visible label (E-03). `errorLabel` names it
 * in the default required line instead (fieldMessages.ts writes that line); a label that is a
 * React node rather than a string gives no words to use, so it needs one.
 */
type Names = { label: string; errorLabel?: string } | { label: ReactNode; errorLabel: string };

type Props = Names & {
  description?: ReactNode;
  errorMessage?: ReactNode;
  isRequired?: boolean;
  /** Invalid. Defaults to whether there is an error message to show */
  isInvalid?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  className?: string;
  /** One Input or Textarea */
  children: ReactNode;
};

/**
 * A label, one text control, optional help text and an optional error line, stacked 4 px apart.
 * Built on React Aria's TextField: it gives the child its label, aria-describedby for the help
 * and the error, aria-invalid, required, disabled and readOnly, while the child keeps its own
 * value and onChange. Help and error render only when there is one, so an absent one leaves no gap.
 * A required, invalid Field given no message shows the contract's default line.
 */
export function Field(props: Props) {
  const {
    label,
    description,
    isRequired = false,
    isDisabled = false,
    isReadOnly = false,
    className = '',
    children,
  } = props;
  const { isInvalid = present(props.errorMessage) } = props;
  const errorMessage = errorLine(props.errorMessage, { isRequired, kind: 'text', names: props });
  return (
    <TextField
      isRequired={isRequired}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      className={`flex flex-col gap-1 ${className}`}
    >
      <Label isRequired={isRequired}>{label}</Label>
      {children}
      {present(description) && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && present(errorMessage) && <FieldErrorText>{errorMessage}</FieldErrorText>}
    </TextField>
  );
}

// The one place the shared controls' default error messages and the subject they name are written
// (02-UI-SPEC.md, "Copywriting Contract"). Controls import these; none repeats the wording, the
// `errorLabel ?? label` fallback (undefined for a control named only by aria-label), or the rule
// for when a message counts as given (`present`, `errorLine`).
// Bounds are shown through formatDay and formatMonth: no date arithmetic or slicing here.
import type { ReactNode } from 'react';
import { formatMonth } from '../../utils/dateRange';
import { formatDay } from '../../utils/dates';

/** What a required, empty control asks for: typed text, a choice from a list, or a toggle */
export type RequiredKind = 'text' | 'choice' | 'toggle';

const ASK: Record<RequiredKind, string> = { text: 'Enter', choice: 'Select', toggle: 'Turn on' };

/** "Enter Name to continue", "Select Account type to continue", "Turn on Up sync to continue" */
export function requiredMessage(kind: RequiredKind, subject: string): string {
  return `${ASK[kind]} ${subject} to continue`;
}

/**
 * What an unset Select shows when its caller gives no placeholder, in place of React Aria's own
 * "Select an item" (02-UI-REVIEW top fix 3). Fixed words, so a label's capitals never land
 * mid-sentence; the same verb as MonthPicker's "Select month".
 */
export const SELECT_PLACEHOLDER = 'Select one';

/** "Enter the full date, like 16/11/2026", the example in the picker's segment order */
export function incompleteDateMessage(example: string): string {
  return `Enter the full date, like ${example}`;
}

/** The bounds of a range: at least one is given, so a message always names one */
type Bounds = [min: string, max: string | undefined] | [min: undefined, max: string];

/** A day outside the picker's bounds (YYYY-MM-DD), the bounds in the Date Format preference */
export function dateRangeMessage(...[min, max]: Bounds): string {
  if (min === undefined) return `Enter a date on or before ${formatDay(max)}`;
  if (max === undefined) return `Enter a date on or after ${formatDay(min)}`;
  return `Enter a date between ${formatDay(min)} and ${formatDay(max)}`;
}

/** A month outside the picker's bounds (YYYY-MM), shown as "Oct 2026" */
export function monthRangeMessage(...[min, max]: Bounds): string {
  if (min === undefined) return `Choose a month on or before ${formatMonth(max)}`;
  if (max === undefined) return `Choose a month on or after ${formatMonth(min)}`;
  return `Choose a month between ${formatMonth(min)} and ${formatMonth(max)}`;
}

/**
 * Whether a help or error line has something to show. An absent one (undefined, null, '', or the
 * false of a caller's `cond && 'text'`) renders nothing, so it leaves no gap.
 */
export const present = (node: ReactNode): boolean => node != null && node !== false && node !== '';

/**
 * The error line a control shows while invalid: the caller's message when it gave one; else the
 * control's own line (a date's half-typed or range line); else, for a required control, the
 * default required line naming `names`' subject; else nothing.
 */
export function errorLine(
  errorMessage: ReactNode,
  {
    isRequired,
    kind,
    names,
    own,
  }: {
    isRequired: boolean;
    kind: RequiredKind;
    names: FieldNames;
    own?: ReactNode;
  },
): ReactNode {
  if (present(errorMessage)) return errorMessage;
  if (present(own)) return own;
  return isRequired ? requiredMessage(kind, fieldSubject(names)) : undefined;
}

/**
 * A control's names, mapped from its own props: `errorLabel`, the visible `label` (a toggle's
 * `children`) and `aria-label` as `ariaLabel`. Each shape makes one of them a string, so a call
 * that could leave the subject undefined (no name, or only a React node label) does not compile.
 */
export type FieldNames =
  | { errorLabel: string; label?: ReactNode; ariaLabel?: string }
  | { errorLabel?: string; label: string; ariaLabel?: string }
  | { errorLabel?: string; label?: ReactNode; ariaLabel: string };

/**
 * How a Select, Combobox or RadioGroup is named: a visible label, or an aria-label when there is
 * none, so the control is never left unnamed
 */
export type LabelNames =
  { label: string; 'aria-label'?: string } | { label?: undefined; 'aria-label': string };

/** Those controls' own props (LabelNames and `errorLabel`) mapped onto fieldSubject's names */
export function namesOf(props: LabelNames & { errorLabel?: string }): FieldNames {
  return props.label !== undefined
    ? { errorLabel: props.errorLabel, label: props.label }
    : { errorLabel: props.errorLabel, ariaLabel: props['aria-label'] };
}

/**
 * The subject of a default message or a Clear button: `errorLabel` when it is a non-empty string,
 * else the label when it is a non-empty string, else the aria-label. Casing is kept as given, so
 * proper nouns such as Up and acronyms such as ABN keep their capitals.
 */
export function fieldSubject({ errorLabel, label, ariaLabel }: FieldNames): string {
  const names = [errorLabel, typeof label === 'string' ? label : undefined, ariaLabel];
  // The type guarantees a string; only a caller passing empty strings everywhere reaches ''
  return names.find((name): name is string => typeof name === 'string' && name !== '') ?? '';
}

/**
 * A toggle's names (Checkbox, Switch): a visible label as `children`, an `aria-label`, or both,
 * so a toggle is never unnamed. A label that is a React node rather than a string gives no words
 * for the default required line, so a required toggle named only by one must pass `errorLabel`.
 */
export type ToggleNames =
  | { children: string; 'aria-label'?: string; isRequired?: boolean; errorLabel?: string }
  | {
      children?: NonNullable<ReactNode>;
      'aria-label': string;
      isRequired?: boolean;
      errorLabel?: string;
    }
  | {
      children: NonNullable<ReactNode>;
      'aria-label'?: undefined;
      isRequired?: false;
      errorLabel?: string;
    }
  | {
      children: NonNullable<ReactNode>;
      'aria-label'?: undefined;
      isRequired: true;
      errorLabel: string;
    };

/** A toggle's own props mapped onto fieldSubject's names: `children` is its label */
export function toggleNames({
  errorLabel,
  children,
  'aria-label': ariaLabel,
}: Pick<ToggleNames, 'errorLabel' | 'children' | 'aria-label'>): FieldNames {
  if (errorLabel !== undefined) return { errorLabel, label: children, ariaLabel };
  if (typeof children === 'string') return { label: children, ariaLabel };
  // ToggleNames requires errorLabel for a required toggle named only by a React node, so a
  // toggle reaching here has an aria-label
  return { label: children, ariaLabel: ariaLabel ?? '' };
}

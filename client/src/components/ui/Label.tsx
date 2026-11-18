import type { ReactNode } from 'react';
import { Label as AriaLabel } from 'react-aria-components';
import { labelClass } from './fieldClasses';

type Props = {
  children: ReactNode;
  /** Adds a required mark; the control itself carries `required` */
  isRequired?: boolean;
  /**
   * `label` by default. `span` for a group that is not labelable (a radio group, a desktop
   * picker), so no <label> points at nothing (`strayLabels` in e2e/tests/accessibility.spec.ts).
   */
  elementType?: 'label' | 'span';
  /** For a bare field outside a Field; inside one, React Aria ties the label itself */
  htmlFor?: string;
  id?: string;
  className?: string;
};

/**
 * A field's visible label, on React Aria's Label so a surrounding Field or other React Aria
 * field gives it its `for` and `id`. Long labels wrap rather than being cut off.
 */
export function Label({
  children,
  isRequired = false,
  elementType = 'label',
  className = '',
  ...rest
}: Props) {
  return (
    <AriaLabel
      {...rest}
      elementType={elementType}
      className={`${labelClass} break-words ${className}`}
    >
      {children}
      {isRequired && (
        <span aria-hidden="true" className="ml-1 text-negative">
          *
        </span>
      )}
    </AriaLabel>
  );
}

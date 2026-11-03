import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

// A disabled filled button turns neutral grey: a pale brand colour reads as a style, not as
// "not yet". Outlined and ghost buttons just fade.
const filledDisabled =
  'disabled:bg-surface-alt disabled:text-text-tertiary disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-border';
// Every variant has a 1px border (transparent unless outlined), so a primary button and a
// secondary one beside it are the same height
const variants = {
  primary: `border border-transparent bg-brand-600 text-brand-contrast hover:bg-brand-700 shadow-xs ${filledDisabled}`,
  secondary:
    'border border-border bg-surface text-text-secondary hover:bg-surface-alt disabled:opacity-50',
  ghost:
    'border border-transparent text-text-secondary hover:bg-surface-alt hover:text-text disabled:opacity-50',
  danger: `border border-transparent bg-negative text-semantic-contrast hover:opacity-90 ${filledDisabled}`,
};

// Fixed heights on the 4px grid: md matches an Input (40px). Phones: at least 44px tall, the
// recommended minimum for a touch target.
const sizes = {
  sm: 'h-8 px-3 text-xs max-md:min-h-11 max-md:text-sm',
  md: 'h-10 px-4 text-sm max-md:min-h-11',
};

const buttonClass = (variant: Variant, size: Size, className: string) =>
  `inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-full transition-colors disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`;

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  // Not "submit" (the browser default): a Button inside a form only submits it when asked
  type = 'button',
  ...props
}: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

/** A link to another page of the app that looks like a Button */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

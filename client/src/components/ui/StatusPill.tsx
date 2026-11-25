import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const DOTS = { good: 'bg-positive', busy: 'bg-brand-500', attention: 'bg-negative' } as const;

/** A small rounded link that says how something stands, with an optional coloured dot */
export function StatusPill({
  to,
  dot,
  children,
  className = '',
}: {
  to: string;
  dot?: keyof typeof DOTS;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface px-2.5 py-0.5 text-xs text-text-secondary hover:text-text ${className}`}
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[dot]}`} />}
      {children}
    </Link>
  );
}

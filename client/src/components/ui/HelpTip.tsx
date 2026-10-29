import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';

/**
 * A small "?" that opens a few words of plain explanation. Opens on tap or click, closes on a
 * second tap, a tap elsewhere or Escape (a hover-only tooltip can't be opened on a phone).
 */
export function HelpTip({
  label,
  children,
  className = '',
  inline = false,
}: {
  /** The button's accessible name, e.g. "What is a funding rule?" */
  label: string;
  children: ReactNode;
  className?: string;
  /** Show the words in the flow of the page (pushing what follows down) instead of floating over it */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={box}
      className={`relative ${inline ? 'inline' : 'inline-block'} align-middle ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="inline-flex items-center justify-center min-w-6 min-h-6 max-md:min-w-11 max-md:min-h-11 rounded-full text-text-tertiary hover:text-text-secondary"
      >
        <CircleHelp size={14} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={`${inline ? 'block mt-1.5 w-full' : 'absolute z-40 left-1/2 top-full mt-1 w-60 max-w-[75vw] -translate-x-1/2'} rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-normal normal-case tracking-normal leading-relaxed text-text shadow-lg`}
        >
          {children}
        </span>
      )}
    </span>
  );
}

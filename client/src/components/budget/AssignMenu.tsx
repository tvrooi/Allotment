import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { useMenuKeyboard } from '../../hooks/useMenuKeyboard';

/**
 * Audit F-13: every planned way to give envelopes money, in one place. Each opens the same kind
 * of preview (what each envelope gets, capped at money you have) before anything changes.
 * Assigning one envelope by hand, and Move money, stay on the envelope itself.
 */
export function AssignMenu({
  disabled,
  underfundedCount,
  onAutoAssign,
  onFundTargets,
}: {
  disabled: boolean;
  underfundedCount: number;
  onAutoAssign: () => void;
  onFundTargets: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuKeyboard({ open, menuRef, buttonRef, onClose: () => setOpen(false) });
  const item = (label: string, action: () => void, hint: string, off = false) => (
    <button
      type="button"
      role="menuitem"
      disabled={off}
      onClick={() => {
        setOpen(false);
        action();
      }}
      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-hover disabled:opacity-50"
    >
      <span className="text-sm text-text">{label}</span>
      <span className="text-xs text-text-tertiary">{hint}</span>
    </button>
  );
  // Nothing underfunded: the menu would hold one item, so show that action directly
  if (underfundedCount === 0) {
    return (
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onAutoAssign}>
        Auto-assign…
      </Button>
    );
  }
  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        size="sm"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Assign <ChevronDown size={14} aria-hidden className="ml-1 inline" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Assign"
          className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {item('Auto-assign', onAutoAssign, 'Top up envelopes by a rule you choose', disabled)}
          {item(
            `Fund targets (${underfundedCount})`,
            onFundTargets,
            'Give underfunded targets what they need',
            disabled,
          )}
        </div>
      )}
    </div>
  );
}

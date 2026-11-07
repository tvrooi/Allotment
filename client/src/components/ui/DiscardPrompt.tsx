import { useEffect, useRef } from 'react';
import { Button } from './Button';

/**
 * Asked when leaving a form or builder with changes that aren't saved (UX audit AU-007):
 * Keep editing (focused, so Enter keeps the work; in a dialog Escape does too) or Discard. Used by ui/Modal's
 * `dirty` and by pages that hold unsaved work, such as the report builder.
 */
export function DiscardPrompt({
  onKeep,
  onDiscard,
  message = 'Discard your changes?',
  className = '',
}: {
  onKeep: () => void;
  onDiscard: () => void;
  message?: string;
  className?: string;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 flex-wrap rounded-md border border-caution/30 bg-caution-subtle px-3 py-2 text-sm text-text ${className}`}
    >
      <span className="flex-1 min-w-0 font-medium">{message}</span>
      <Button ref={keep} size="sm" variant="secondary" onClick={onKeep}>
        Keep editing
      </Button>
      <Button size="sm" variant="danger" onClick={onDiscard}>
        Discard
      </Button>
    </div>
  );
}

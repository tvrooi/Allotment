import { useEffect, useId, useRef, useState } from 'react';
import { MAX_NOTE_LENGTH } from '../../api/budget';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';

/**
 * A note on the budget (BUD-10): a month's, or a category's. It saves when the field is left, so
 * closing a phone sheet or ticking another envelope keeps what was typed; a refused save keeps
 * the text, with the reason, to try again. Key it by what it's a note on, so switching resets it.
 */
export function NoteField({
  label,
  note,
  onSave,
}: {
  label: string;
  /** The saved note ('' for none) */
  note: string;
  /** Resolves once saved; rejects with why not */
  onSave: (note: string) => Promise<unknown>;
}) {
  const id = useId();
  const canSave = useCanSave();
  const [draft, setDraft] = useState(note);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // What the server holds now: the last save that succeeded here, or a newer note from a refetch.
  // A phone sheet passes the category as it was when the sheet opened, so `note` alone would
  // stay stale after a save, and clearing the note again would look unchanged and be skipped
  const saved = useRef(note.trim());
  useEffect(() => {
    saved.current = note.trim();
  }, [note]);

  async function save() {
    const text = draft.trim();
    if (text === saved.current || !canSave) return;
    setStatus('saving');
    setError(null);
    try {
      await onSave(draft);
      saved.current = text;
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
    }
  }

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <textarea
        id={id}
        value={draft}
        maxLength={MAX_NOTE_LENGTH}
        rows={2}
        readOnly={!canSave}
        onChange={(e) => {
          setDraft(e.target.value);
          if (status !== 'saving') setStatus('idle');
        }}
        onBlur={() => void save()}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={`${id}-status`}
        placeholder="Add a note"
        className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-600 read-only:opacity-60"
      />
      <span id={`${id}-status`} role="status" className="text-xs">
        {status === 'saving' && <span className="text-text-tertiary">Saving…</span>}
        {status === 'saved' && <span className="text-text-tertiary">Note saved.</span>}
        {status === 'error' && <span className="text-negative">Note not saved. {error}</span>}
      </span>
      <SavingPausedHint />
    </div>
  );
}

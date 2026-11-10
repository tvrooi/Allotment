import { useEffect } from 'react';
import { AlertTriangle, Check, Info, Undo2, Redo2, X } from 'lucide-react';
import { useUndoStore } from '../../store/undoStore';

export function UndoToast() {
  const message = useUndoStore((s) => s.toastMessage);
  const action = useUndoStore((s) => s.toastAction);
  const clearToast = useUndoStore((s) => s.clearToast);
  const undo = useUndoStore((s) => s.undo);
  const redo = useUndoStore((s) => s.redo);

  useEffect(() => {
    if (!message) return;
    // Something just done stays a little longer, so there's time to undo it
    const t = setTimeout(clearToast, action === 'done' ? 6000 : action === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [message, action, clearToast]);

  if (!message) return null;

  const icon =
    action === 'error' ? (
      <AlertTriangle size={14} />
    ) : action === 'undo' ? (
      <Undo2 size={14} />
    ) : action === 'redo' ? (
      <Redo2 size={14} />
    ) : action === 'done' ? (
      <Check size={14} />
    ) : (
      <Info size={14} />
    );
  const text =
    action === 'undo' ? `Undid: ${message}` : action === 'redo' ? `Redid: ${message}` : message;
  // After an undo, offer Redo; after a redo or something just done, offer Undo
  const button =
    action === 'undo' ? 'Redo' : action === 'note' || action === 'error' ? null : 'Undo';

  return (
    <div
      role={action === 'error' ? 'alert' : undefined}
      aria-live={action === 'error' ? 'assertive' : 'polite'}
      data-testid="undo-toast"
      className="pointer-events-auto max-w-full flex items-center gap-3 bg-text text-surface rounded-lg shadow-lg px-4 py-2.5 text-sm"
    >
      {icon}
      <span className="min-w-0 break-words">{text}</span>
      {button && (
        <button
          onClick={() => {
            clearToast();
            if (action === 'undo') void redo();
            else void undo();
          }}
          className="ml-1 shrink-0 max-md:min-h-11 max-md:min-w-11 font-medium text-brand-300 hover:text-brand-200 transition-colors"
        >
          {button}
        </button>
      )}
      <button
        onClick={clearToast}
        aria-label="Dismiss"
        className="ml-1 shrink-0 max-md:min-h-11 max-md:min-w-11 flex items-center justify-center text-surface/60 hover:text-surface transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

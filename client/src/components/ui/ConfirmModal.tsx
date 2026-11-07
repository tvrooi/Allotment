import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The action. Return its promise (e.g. a mutation's `mutateAsync`) and the dialog waits for
   * it: it shows `pendingLabel` and can't be pressed again meanwhile, closes only once it
   * succeeds, and stays open with the reason if it fails (UX audit AU-006). Return nothing and
   * it closes straight away, as before.
   */
  onConfirm: () => unknown;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Shown on the button while a returned promise is pending, e.g. "Deleting…" */
  pendingLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  danger = false,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  // A new confirmation starts clean
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setError('');
  }

  // Nothing closes it while the action runs: closing would look like it finished
  const close = () => {
    if (!pending) onClose();
  };

  async function confirm() {
    if (pending) return;
    const result = onConfirm();
    if (!(result instanceof Promise)) {
      onClose();
      return;
    }
    setError('');
    setPending(true);
    try {
      await result;
      setPending(false);
      onClose();
    } catch (e) {
      setPending(false);
      setError(e instanceof Error && e.message ? e.message : "That didn't work. Nothing changed.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} size="sm">
      <p className="text-sm text-text-secondary">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={close} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => void confirm()}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

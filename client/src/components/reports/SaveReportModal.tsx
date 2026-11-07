import { useState, useId } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the report. The dialog closes once it succeeds, and stays open with the reason (and
   * the name kept) if it fails, so nothing looks saved that wasn't (UX audit AU-005). */
  onSave: (name: string) => Promise<unknown>;
  initialName?: string;
  isUpdating?: boolean;
}

export default function SaveReportModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  isUpdating,
}: Props) {
  const fieldId = useId();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setError('');
    setSaving(true);
    try {
      await onSave(name.trim());
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error && err.message ? err.message : "Couldn't save the report. Try again.",
      );
    }
  }

  // Closing while it saves would look like it was cancelled
  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isUpdating ? 'Update report' : 'Save report'}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <label
          htmlFor={`${fieldId}-name`}
          className="block text-sm font-medium text-text-secondary mb-1"
        >
          Report name
        </label>
        <Input
          id={`${fieldId}-name`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Monthly Spending by Payee"
          aria-label="Report name"
          autoFocus
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || saving} aria-busy={saving || undefined}>
            {saving ? 'Saving…' : isUpdating ? 'Update' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { Button } from '../ui/Button';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { saveReminderSettings, sendTestReminder } from '../../api/reminders';
import { REMINDERS_QUERY_KEY, useReminderSettings } from '../../hooks/useReminders';

// Settings → Server → Reminders (FINX-02): which Home Assistant notify service gets bill and
// payday reminders. Each schedule chooses its own lead in the schedule's form; nothing is sent
// until both are set. The message is generic unless the owner asks for names and amounts.

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:border-brand-600 focus:outline-none';

export function ReminderSettings() {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data } = useReminderSettings();
  const [service, setService] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setService(data.service ?? '');
    setShowDetails(data.showDetails);
  }, [data]);

  const save = useMutation({
    mutationFn: saveReminderSettings,
    onSuccess: (saved) => {
      qc.setQueryData(REMINDERS_QUERY_KEY, saved);
      setMessage({
        ok: true,
        text: saved.service ? 'Saved. Send a test to check it reaches you.' : 'Reminders are off.',
      });
    },
    onError: (e) => setMessage({ ok: false, text: (e as Error).message }),
  });
  const test = useMutation({
    mutationFn: sendTestReminder,
    onSuccess: () => setMessage({ ok: true, text: 'Sent. Check your phone.' }),
    onError: (e) => setMessage({ ok: false, text: (e as Error).message }),
  });

  // Not on this install (a desktop, Docker or demo copy, or a budget of a multi-user server):
  // say so rather than leave a control that does nothing
  if (!data) return null;

  const dirty = (data.service ?? '') !== service.trim() || data.showDetails !== showDetails;

  return (
    <section className="pt-6 border-t border-border-light">
      <h2 className="text-sm font-semibold text-text">Reminders</h2>
      <p className="text-xs text-text-tertiary mt-1">
        Get a Home Assistant notification a few days before a bill or payday. Choose how early in
        each schedule (Recurring, then Add or Edit). A reminder goes out once, in the daytime, and
        nothing leaves your Home Assistant.
      </p>
      {!data.available ? (
        <p className="text-xs text-text-secondary mt-3" role="status">
          Reminders need Allotment to run as a Home Assistant app with its own budget. They are not
          available here.
        </p>
      ) : (
        <form
          className="mt-3 space-y-3 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            save.mutate({ service: service.trim() || null, showDetails });
          }}
        >
          <label className="block">
            <span className="block text-xs font-medium text-text-secondary mb-1">
              Notify service
            </span>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. mobile_app_your_phone"
              maxLength={100}
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
            />
            <span className="block text-xs text-text-tertiary mt-1">
              The name of a Home Assistant notify service, without “notify.”. Leave it empty to turn
              reminders off.
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="mt-0.5 rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-text-secondary">
              Include the name and amount
              <span className="block text-xs text-text-tertiary">
                Off, a reminder only says how many items are due. A phone's lock screen shows the
                text to anyone holding it.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!dirty || save.isPending || !canSave}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!data.service || dirty || test.isPending || !canSave}
              onClick={() => {
                setMessage(null);
                test.mutate();
              }}
            >
              <BellRing size={14} /> Send a test
            </Button>
          </div>
          <SavingPausedHint />
          {message && (
            <p
              className={`text-xs ${message.ok ? 'text-text-secondary' : 'text-negative'}`}
              role="status"
            >
              {message.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

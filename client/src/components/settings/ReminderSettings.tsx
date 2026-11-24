import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { useEffect, useId, useState } from 'react';
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
// Behind the multi-user gateway (D2b) there is no service to name: reminders are on or off, and
// go to the person's own phone or email, chosen under Password codes.

export function ReminderSettings() {
  const qc = useQueryClient();
  const canSave = useCanSave();
  const { data } = useReminderSettings();
  const [service, setService] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const headingId = useId();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setService(data.service ?? '');
    setEnabled(data.enabled);
    setShowDetails(data.showDetails);
  }, [data]);

  const save = useMutation({
    mutationFn: saveReminderSettings,
    onSuccess: (saved) => {
      qc.setQueryData(REMINDERS_QUERY_KEY, saved);
      setMessage({
        ok: true,
        text: saved.enabled ? 'Saved. Send a test to check it reaches you.' : 'Reminders are off.',
      });
    },
    onError: (e) => setMessage({ ok: false, text: (e as Error).message }),
  });
  const test = useMutation({
    mutationFn: sendTestReminder,
    onSuccess: () =>
      setMessage({
        ok: true,
        text: data?.viaGateway ? 'Sent. Check your phone or email.' : 'Sent. Check your phone.',
      }),
    onError: (e) => setMessage({ ok: false, text: (e as Error).message }),
  });

  // Not on this install (a desktop, Docker or demo copy): say so rather than leave a control
  // that does nothing
  if (!data) return null;

  const dirty =
    (data.viaGateway ? data.enabled !== enabled : (data.service ?? '') !== service.trim()) ||
    data.showDetails !== showDetails;

  return (
    <section aria-labelledby={headingId} className="pt-6 border-t border-border-light">
      <h2 id={headingId} className="text-sm font-semibold text-text">
        Reminders
      </h2>
      <p className="text-xs text-text-tertiary mt-1">
        {data.viaGateway
          ? 'Get a message a few days before a bill or payday. '
          : 'Get a Home Assistant notification a few days before a bill or payday. '}
        Choose how early in each schedule (Recurring, then Add or Edit). A reminder goes out once,
        in the daytime
        {data.viaGateway ? '.' : ', and nothing leaves your Home Assistant.'}
      </p>
      {!data.available ? (
        <p className="text-xs text-text-secondary mt-3" role="status">
          Reminders need Allotment to run as a Home Assistant app. They are not available here.
        </p>
      ) : (
        <form
          className="mt-3 space-y-3 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            save.mutate(
              data.viaGateway
                ? { enabled, showDetails }
                : { service: service.trim() || null, showDetails },
            );
          }}
        >
          {data.viaGateway ? (
            <Checkbox
              checked={enabled}
              onCheckedChange={setEnabled}
              description="They go to your phone or email, chosen under Password codes."
            >
              Send reminders
            </Checkbox>
          ) : (
            <label className="block">
              <span className="block text-xs font-medium text-text-secondary mb-1">
                Notify service
              </span>
              <Input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. mobile_app_your_phone"
                maxLength={100}
                autoCapitalize="none"
                spellCheck={false}
              />
              <span className="block text-xs text-text-tertiary mt-1">
                The name of a Home Assistant notify service, without “notify.”. Leave it empty to
                turn reminders off.
              </span>
            </label>
          )}
          <Checkbox
            checked={showDetails}
            onCheckedChange={setShowDetails}
            description="Off, a reminder only says how many items are due. A phone's lock screen shows the text to anyone holding it."
          >
            Include the name and amount
          </Checkbox>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!dirty || save.isPending || !canSave}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!data.enabled || dirty || test.isPending || !canSave}
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

// On Home Assistant (the app has a Supervisor token, homeassistant_api in config.yaml) the
// reset code is also shown as a persistent notification, which only people signed in to Home
// Assistant can see. Elsewhere the code is only in the server log.

const NOTIFICATION_ID = 'flybudget_password_reset';
const SERVICE = 'http://supervisor/core/api/services/persistent_notification';

/** Whether Home Assistant notifications can be sent (the app runs on Home Assistant) */
export const canNotifyHomeAssistant = () => Boolean(process.env.SUPERVISOR_TOKEN);

async function call(action: 'create' | 'dismiss', body: object, fetchImpl: typeof fetch) {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return;
  const res = await fetchImpl(`${SERVICE}/${action}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: NOTIFICATION_ID, ...body }),
  });
  if (!res.ok) throw new Error(`Home Assistant could not ${action} it (error ${res.status})`);
}

export function notifyResetCode(code: string, fetchImpl: typeof fetch = fetch) {
  return call(
    'create',
    {
      title: 'Allotment password reset',
      message: `Your Allotment reset code is ${code}. It works once, for 24 hours. If you did not ask for it, ignore this and no one can sign in with it.`,
    },
    fetchImpl,
  );
}

export function dismissResetNotification(fetchImpl: typeof fetch = fetch) {
  return call('dismiss', {}, fetchImpl);
}

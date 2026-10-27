// Password codes sent as Home Assistant notifications (docs/MULTI-USER-PLAN.md): on Home
// Assistant OS the app gets a Supervisor token (homeassistant_api in config.yaml) and calls a
// notify service such as notify.mobile_app_partners_phone, which reaches that person's phone
// through the Companion app. No mail server and nothing exposed to the internet.

/** A notify service name as Home Assistant writes them, without the "notify." part */
export const NOTIFY_SERVICE = /^[a-z0-9_]{1,100}$/;

export type Notify = (service: string, title: string, message: string) => Promise<void>;

/** Whether notifications can be sent at all (the app runs on Home Assistant) */
export const canNotify = () => Boolean(process.env.SUPERVISOR_TOKEN);

export function homeAssistantNotify(fetchImpl: typeof fetch = fetch): Notify {
  return async (service, title, message) => {
    const token = process.env.SUPERVISOR_TOKEN;
    if (!token) throw new Error('Home Assistant notifications are not available here');
    if (!NOTIFY_SERVICE.test(service)) throw new Error('That is not a notify service name');
    const res = await fetchImpl(`http://supervisor/core/api/services/notify/${service}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message }),
    });
    if (!res.ok)
      throw new Error(
        res.status === 400 || res.status === 404
          ? `Home Assistant has no notify.${service} service`
          : `Home Assistant could not send it (error ${res.status})`,
      );
  };
}

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

/**
 * Behind the multi-user gateway (D2b, docs/MULTI-USER-EMAIL-AND-REMINDERS.md): a budget's
 * messages go to its own person, wherever they chose under Password codes. The gateway passes
 * the budget a loopback URL and a token of its own; the budget never names a destination, so
 * `service` is ignored.
 */
export function gatewayNotify(url: string, token: string, fetchImpl: typeof fetch = fetch): Notify {
  return async (_service, title, message) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message }),
    });
    if (!res.ok)
      throw new Error(
        res.status === 409
          ? 'Add a phone or email under Settings → Server → Password codes first'
          : res.status === 422
            ? 'Your phone or email could not be reached. Check it under Password codes.'
            : `The reminder could not be sent (error ${res.status})`,
      );
  };
}

/** The gateway's notify URL and token for this budget, when it runs behind the gateway */
export function gatewayNotifySettings(env: NodeJS.ProcessEnv = process.env) {
  const url = env.FLYBUDGET_NOTIFY_URL;
  const token = env.FLYBUDGET_NOTIFY_TOKEN;
  return url && token && /^http:\/\/127\.0\.0\.1:\d+\/notify$/.test(url)
    ? { url, token }
    : undefined;
}

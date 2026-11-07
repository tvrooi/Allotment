import { Router } from 'express';
import { z } from 'zod';
import { canNotify, homeAssistantNotify, NOTIFY_SERVICE, type Notify } from '../gateway/notify.js';
import { getBudgetSettings, updateBudgetSettings } from '../services/mainAmountService.js';
import { reminderService } from '../services/reminderService.js';

// Settings → Server → Reminders (FINX-02): which Home Assistant notify service gets bill and
// payday reminders, and whether they name the bill. Each schedule chooses its own lead.
// A single-budget Home Assistant app sends them itself with the Supervisor token; a desktop or
// Docker install has none. Behind the multi-user gateway (`viaGateway`, D2b) a budget only
// turns them on and off: the gateway sends them to its person's own phone or email, so the
// budget never names a destination.

export function createRemindersRouter(
  notify: Notify = homeAssistantNotify(),
  available: () => boolean = canNotify,
  viaGateway = false,
) {
  const router = Router();

  const state = () => {
    const s = getBudgetSettings();
    return {
      available: available(),
      viaGateway,
      enabled: reminderService(s, viaGateway) !== null,
      service: viaGateway ? null : s.reminderNotifyService,
      showDetails: s.reminderShowDetails === 1,
    };
  };

  router.get('/', (_req, res) => res.json(state()));

  router.put('/', (req, res) => {
    if (viaGateway) {
      const parsed = z
        .object({ enabled: z.boolean(), showDetails: z.boolean() })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid reminders' });
      updateBudgetSettings({
        remindersViaGateway: parsed.data.enabled ? 1 : 0,
        reminderShowDetails: parsed.data.showDetails ? 1 : 0,
      });
      return res.json(state());
    }
    const parsed = z
      .object({
        service: z
          .string()
          .trim()
          .regex(NOTIFY_SERVICE, 'Use the service name without "notify.", such as mobile_app_phone')
          .nullable(),
        showDetails: z.boolean(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid reminders' });
    if (parsed.data.service && !available())
      return res
        .status(409)
        .json({ error: 'Reminders need Allotment to run as a Home Assistant app' });
    updateBudgetSettings({
      reminderNotifyService: parsed.data.service,
      reminderShowDetails: parsed.data.showDetails ? 1 : 0,
    });
    res.json(state());
  });

  // A test message, so a wrong service name shows up now and not on the day a bill is due
  router.post('/test', async (_req, res) => {
    const service = reminderService(getBudgetSettings(), viaGateway);
    if (!available() || service === null)
      return res
        .status(409)
        .json({ error: viaGateway ? 'Turn reminders on first' : 'Choose a notify service first' });
    try {
      await notify(service, 'Allotment: test', 'Bill reminders will arrive here.');
      res.json({ sent: true });
    } catch (err) {
      // The messages are ours and say what went wrong; 422, not 5xx, so the app doesn't read it as "server down"
      res.status(422).json({ error: err instanceof Error ? err.message : 'Could not send it' });
    }
  });

  return router;
}

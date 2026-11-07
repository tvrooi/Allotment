import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import type { Budgets } from './budgets.js';
import { delivery, type DeliveryOptions } from './delivery.js';
import type { GatewayStore } from './store.js';

// Reminders for separate budgets (D2b, docs/MULTI-USER-EMAIL-AND-REMINDERS.md). Each budget
// works out what is due, as a single budget does, and asks the gateway to "send this to my
// person". This listener is on loopback only, never on the public port. A budget proves which
// person it is with the notify token the gateway gave it at launch (budgets.ts), so it can't
// send as anyone else, and it never names a destination: the gateway sends to the person's
// own confirmed phone or email, as they chose under Password codes.

const BEARER = /^Bearer\s+(\S{1,200})$/i;
// No line breaks or other control characters in a title: it is an email's subject
const title = z
  .string()
  .min(1)
  .max(100)
  .refine((t) => !/[\u0000-\u001f\u007f]/.test(t));

export interface NotifyListenerOptions extends DeliveryOptions {
  store: GatewayStore;
  budgets: Budgets;
}

export function createNotifyListener(o: NotifyListenerOptions) {
  const { send, reminderTargets } = delivery(o);
  const app = express();
  app.disable('x-powered-by');

  app.post(
    '/notify',
    (req, res, next) => {
      const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
      const personId = token && o.budgets.personForNotifyToken(token);
      const person = personId ? o.store.person(personId) : undefined;
      if (!person || person.disabled) return void res.status(401).json({ error: 'Unauthorized' });
      res.locals.person = person;
      next();
    },
    express.json({ limit: '16kb' }),
    async (req, res) => {
      const parsed = z
        .object({ title, message: z.string().min(1).max(2000) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid message' });
      const targets = reminderTargets(res.locals.person);
      if (!targets.length) return res.status(409).json({ error: 'No phone or email to send to' });
      const results = await Promise.allSettled(
        targets.map((t) => send(t, parsed.data.title, parsed.data.message)),
      );
      results.forEach((r, i) => {
        if (r.status === 'rejected')
          console.error(`A reminder could not be sent (${targets[i].to}):`, r.reason?.message);
      });
      // Delivered somewhere: the budget marks it sent, so it never arrives twice
      if (!results.some((r) => r.status === 'fulfilled'))
        return res.status(422).json({ error: 'It could not be delivered' });
      res.status(204).send();
    },
  );

  app.use((_req, res) => void res.status(404).json({ error: 'Not found' }));
  // A body too large or not JSON: a plain answer, never Express's HTML page
  const errors: ErrorRequestHandler = (err, _req, res, _next) =>
    void res
      .status(typeof err?.status === 'number' && err.status < 500 ? err.status : 400)
      .json({ error: 'Invalid request' });
  app.use(errors);
  return app;
}

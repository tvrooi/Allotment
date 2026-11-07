import type { Mailer } from './mail.js';
import type { Notify } from './notify.js';
import type { CodeChannel, Destination, Person } from './store.js';

// Where the gateway sends a person's messages (docs/MULTI-USER-EMAIL-AND-REMINDERS.md): their
// own confirmed phone (a Home Assistant notify service) or email address. Password codes and
// reminders each have their own choice of phone, email or both; both pick from here.

export interface DeliveryOptions {
  notify: Notify;
  canNotify: () => boolean;
  /** Absent when no mail server is set in the app's options */
  mail?: Mailer;
}

export interface Target {
  to: Destination;
  address: string;
}

export function delivery(o: DeliveryOptions) {
  const canEmail = () => Boolean(o.mail);

  /** Sends to one destination: the title is a phone notification's title, an email's subject */
  const send = ({ to, address }: Target, title: string, text: string) =>
    to === 'phone' ? o.notify(address, title, text) : o.mail!(address, title, text);

  /**
   * The person's destinations for `choice` that can be used here. When none of those can (the
   * administrator turned email off, say), whichever they have that can, so a server setting
   * doesn't cut anyone off.
   */
  function targets(p: Person, choice: CodeChannel): Target[] {
    const usable = [
      p.notifyService && o.canNotify() ? { to: 'phone' as const, address: p.notifyService } : null,
      p.email && canEmail() ? { to: 'email' as const, address: p.email } : null,
    ].filter((d) => d !== null);
    const chosen = usable.filter((d) => choice === 'both' || choice === d.to);
    return chosen.length ? chosen : usable;
  }

  return {
    canEmail,
    send,
    /** Password codes: where the person chose, both until they choose */
    codeTargets: (p: Person) => targets(p, p.codeChannel ?? 'both'),
    /** Reminders: where the person chose, their phone until they choose */
    reminderTargets: (p: Person) => targets(p, p.reminderChannel ?? 'phone'),
  };
}

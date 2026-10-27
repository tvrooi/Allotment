// Multi-user mode (docs/MULTI-USER-PLAN.md): which person's budget this page shows. Every
// request carries it, and the gateway refuses one when someone else has signed in on this
// browser since (the session cookie is shared by all tabs). Kept in localStorage so a
// reloaded tab, its offline copy and other tabs agree on it. Single-user servers, the
// desktop app and dev mode have no person: nothing is sent or stored.

export const PERSON_HEADER = 'x-flybudget-person';
export const PERSON_STORAGE_KEY = 'flybudget:person';
/** The gateway's answer when the page expected someone else (another person signed in) */
export const PERSON_CHANGED_CODE = 'person-changed';
export const PERSON_CHANGED_EVENT = 'flybudget:person-changed';

function read(): string | null {
  try {
    return localStorage.getItem(PERSON_STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: string | null = typeof window === 'undefined' ? null : read();

/** The person this page shows, if known */
export const signedInPerson = () => current;

/** Records who signed in on this page (null: signed out), for this tab and the next ones */
export function setSignedInPerson(id: string | null) {
  if (id === current) return;
  current = id;
  try {
    if (id) localStorage.setItem(PERSON_STORAGE_KEY, id);
    else localStorage.removeItem(PERSON_STORAGE_KEY);
  } catch {
    // Storage blocked: this tab still sends it
  }
}

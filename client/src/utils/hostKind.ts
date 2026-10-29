// Where the server runs, so a screen can say where its log is. The server reports it with the
// sign-in status (not sensitive: a kind of host). The last answer is kept on this device for
// the reconnect screen, which can't ask a server that isn't answering.
export type HostKind = 'home-assistant' | 'docker' | 'other';

const KEY = 'budget-host-kind';

export function rememberHostKind(kind: HostKind | undefined) {
  if (!kind) return;
  try {
    localStorage.setItem(KEY, kind);
  } catch {
    /* private window: the screen falls back to the general wording */
  }
}

export function lastHostKind(): HostKind | undefined {
  try {
    const kind = localStorage.getItem(KEY);
    return kind === 'home-assistant' || kind === 'docker' || kind === 'other' ? kind : undefined;
  } catch {
    return undefined;
  }
}

/** A sentence saying where the server's log is */
export function whereIsTheLog(kind: HostKind | undefined, { notifications = false } = {}): string {
  if (kind === 'home-assistant')
    return notifications
      ? 'Find it in Home Assistant: Settings → Apps → FlyBudget → Log (or the Notifications bell in the sidebar).'
      : 'Find it in Home Assistant: Settings → Apps → FlyBudget → Log.';
  if (kind === 'docker') return 'Docker: run docker logs flybudget on the server.';
  return "Find it in the server's log, wherever FlyBudget runs.";
}

/** The parts of a KeyboardEvent a one-key page shortcut looks at */
export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  defaultPrevented: boolean;
  target: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
}

/**
 * Whether a key press is the one-key shortcut `key` (`?` for guides, `n` to add a
 * transaction): not while someone is typing, not with Ctrl, ⌘ or Alt held (those belong to the
 * browser and system), not when something else handled it, and not while a dialog is open.
 */
export function isPageShortcut(e: ShortcutKeyEvent, key: string, dialogOpen: boolean) {
  if (e.key !== key || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false;
  const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable)
    return false;
  return !dialogOpen;
}

/**
 * Whether a key press opens the search palette: ⌘K or Ctrl+K from anywhere, a field included
 * (a held modifier isn't typing), or `/` as a one-key shortcut. Never while a dialog is open.
 */
export function isPaletteShortcut(e: ShortcutKeyEvent, dialogOpen: boolean) {
  if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey)
    return !e.defaultPrevented && !dialogOpen;
  return isPageShortcut(e, '/', dialogOpen);
}

/** What the ⌘ or Ctrl key is called on this device, for showing a shortcut */
export const modifierKeyName = (userAgent = navigator.userAgent) =>
  /Mac|iPhone|iPad|iPod/.test(userAgent) ? 'Cmd' : 'Ctrl';

/** Whether a dialog is open on the page right now */
export const dialogOpen = () => !!document.querySelector('[role="dialog"]');

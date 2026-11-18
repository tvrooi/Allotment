/**
 * Makes the app (#root) inert while something covers it: an open dialog (ui/Modal) or a
 * guide (guide/GuideTour). Each holder gets a release function; the app stays inert until
 * every holder has released, so one closing never re-enables the page under another.
 * Dialogs, menus and toasts render outside #root (portals on <body>), so they stay usable.
 */
let holders = 0;
let watcher: MutationObserver | null = null;

/**
 * Puts `inert` back while something still holds the app inert. React Aria's ariaHideOutside,
 * which a Combobox list runs while open, restores each node it hid by also setting
 * `inert = false`, so closing a list inside a dialog made the page under the dialog take Tab
 * and clicks again (#267, plan 02-11).
 */
function keepInert(root: HTMLElement) {
  if (watcher || typeof MutationObserver === 'undefined') return;
  watcher = new MutationObserver(() => {
    if (holders > 0 && !root.inert) root.inert = true;
  });
  watcher.observe(root, { attributes: true, attributeFilter: ['inert'] });
}

export function holdRootInert(): () => void {
  const root = document.getElementById('root');
  holders += 1;
  if (root) {
    root.inert = true;
    keepInert(root);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0 && root) {
      watcher?.disconnect();
      watcher = null;
      root.inert = false;
    }
  };
}

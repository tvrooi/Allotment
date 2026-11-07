/**
 * Makes the app (#root) inert while something covers it: an open dialog (ui/Modal) or a
 * guide (guide/GuideTour). Each holder gets a release function; the app stays inert until
 * every holder has released, so one closing never re-enables the page under another.
 * Dialogs, menus and toasts render outside #root (portals on <body>), so they stay usable.
 */
let holders = 0;

export function holdRootInert(): () => void {
  const root = document.getElementById('root');
  holders += 1;
  if (root) root.inert = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0 && root) root.inert = false;
  };
}

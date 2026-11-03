import { useEffect, useRef, type RefObject } from 'react';

const ITEMS = '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])';

/**
 * A drop-down menu that behaves like one: opening it focuses its first item; Up and Down
 * (wrapping round), Home and End move between items; Escape closes it and puts focus back on
 * its button; focus leaving it (Tab past its end), a press anywhere else or a resized window
 * closes it. A menu this one opened (drawn elsewhere on the page) counts as inside, and while
 * focus is in that one its own Escape and arrows apply, not this menu's.
 */
export function useMenuKeyboard({
  open,
  menuRef,
  buttonRef,
  onClose,
  closeOnOutsidePress = true,
}: {
  open: boolean;
  menuRef: RefObject<HTMLElement | null>;
  buttonRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** False when the menu has a backdrop of its own that takes the press (and closes it) */
  closeOnOutsidePress?: boolean;
}) {
  // The latest onClose, without reopening the effect each render
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []);
    items()[0]?.focus({ preventScroll: true });

    // A menu this one opened: open, but not the menu this one's button sits in
    const inChildMenu = (t: Element | null) => {
      const other = t?.closest('[role="menu"]');
      return !!other && !other.contains(buttonRef.current);
    };
    const outside = (t: EventTarget | null) =>
      t instanceof Element &&
      !menuRef.current?.contains(t) &&
      !buttonRef.current?.contains(t) &&
      !inChildMenu(t);
    const onDown = (e: PointerEvent) => outside(e.target) && close.current();
    const onFocus = (e: FocusEvent) => outside(e.target) && close.current();
    const onKey = (e: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const focused = document.activeElement;
      const inMenu = menu.contains(focused);
      // Focus is in another menu this one opened: that menu handles its own keys
      if (!inMenu && inChildMenu(focused)) return;
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        close.current();
        buttonRef.current?.focus();
      } else if (inMenu && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const all = items();
        if (!all.length) return;
        const at = all.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : e.key === 'ArrowDown'
                ? (at + 1) % all.length
                : (at - 1 + all.length) % all.length;
        all[next].focus();
      }
    };
    const onResize = () => close.current();
    if (closeOnOutsidePress) document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, menuRef, buttonRef, closeOnOutsidePress]);
}

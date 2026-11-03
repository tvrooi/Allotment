import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsPhone } from '../../hooks/useIsPhone';

// A menu opened at the pointer (right-click), from the keyboard (Shift+F10 or the Menu key),
// by a long press, or from a ⋯ button. Sub-menus fly out beside their item; on a phone they
// open in place, with a Back item. Arrow keys move, Right/Enter opens a sub-menu, Left/Escape
// goes back, and closing returns focus to where it was.

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  /** A second line: a split, or why the item can't be used */
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Draws a line above the item */
  separatorBefore?: boolean;
  onSelect?: () => void;
  submenu?: MenuItem[];
}

export interface MenuPoint {
  x: number;
  y: number;
}

interface Props {
  items: MenuItem[];
  at: MenuPoint;
  onClose: () => void;
  /** The menu's accessible name, e.g. "Actions for Mock Grocer" */
  label: string;
}

const WIDTH = 240;
const GAP = 8;

export function ContextMenu({ items, at, onClose, label }: Props) {
  const isPhone = useIsPhone();
  const rootRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where focus was before the menu opened, to return it on close
  const returnFocus = useRef<Element | null>(document.activeElement);
  const [openSub, setOpenSub] = useState<{ key: string; focus: boolean } | null>(null);
  const [rootPos, setRootPos] = useState<{ left: number; top: number } | null>(null);
  const [subPos, setSubPos] = useState<{ left: number; top: number } | null>(null);
  const subItem = openSub ? items.find((i) => i.key === openSub.key) : undefined;
  // On a phone the sub-menu replaces the menu in place
  const inPlace = isPhone && subItem;

  const close = (restore = true) => {
    onClose();
    if (restore && returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
  };

  // Keep the menu on screen: open left of or above the point when there is no room
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.max(GAP, Math.min(at.x, window.innerWidth - width - GAP));
    const top =
      at.y + height > window.innerHeight - GAP
        ? Math.max(GAP, window.innerHeight - height - GAP)
        : at.y;
    setRootPos({ left, top });
  }, [at.x, at.y, inPlace, items]);

  useLayoutEffect(() => {
    if (!openSub || inPlace) return setSubPos(null);
    const trigger = triggerRefs.current.get(openSub.key);
    const el = subRef.current;
    if (!trigger || !el) return;
    const r = trigger.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    const left = r.right + width > window.innerWidth - GAP ? r.left - width : r.right;
    const top = Math.max(GAP, Math.min(r.top - 4, window.innerHeight - height - GAP));
    setSubPos({ left: Math.max(GAP, left), top });
  }, [openSub, inPlace, rootPos]);

  // Focus the first item when the menu opens, and the sub-menu's when it's opened by key
  useEffect(() => {
    firstItem(rootRef.current)?.focus();
  }, []);
  useEffect(() => {
    if (inPlace) firstItem(rootRef.current)?.focus();
    else if (openSub?.focus && subPos) firstItem(subRef.current)?.focus();
  }, [openSub, subPos, inPlace]);

  useEffect(() => {
    const inside = (t: EventTarget | null) =>
      t instanceof Node && (rootRef.current?.contains(t) || subRef.current?.contains(t));
    const onDown = (e: Event) => !inside(e.target) && close(false);
    const onScroll = (e: Event) => !inside(e.target) && close(false);
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onResize);
    };
    // close only calls onClose, which may change identity on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToRoot = () => {
    const key = openSub?.key;
    setOpenSub(null);
    if (key) requestAnimationFrame(() => triggerRefs.current.get(key)?.focus());
  };

  function onKeyDown(e: React.KeyboardEvent, level: 'root' | 'sub') {
    const list = level === 'sub' ? subRef.current : rootRef.current;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      move(list, e.key);
    } else if (e.key === 'Escape' || (e.key === 'ArrowLeft' && (level === 'sub' || inPlace))) {
      e.preventDefault();
      e.stopPropagation();
      if (level === 'sub' || inPlace) backToRoot();
      else close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  }

  function renderItems(list: MenuItem[], level: 'root' | 'sub') {
    return list.map((item) => {
      const hasSub = !!item.submenu?.length;
      const expanded = hasSub && openSub?.key === item.key;
      return (
        <div key={item.key} role="none">
          {item.separatorBefore && <div role="separator" className="my-1 border-t border-border" />}
          <button
            type="button"
            role="menuitem"
            ref={(el) => {
              if (level === 'root' && el) triggerRefs.current.set(item.key, el);
            }}
            disabled={item.disabled}
            aria-haspopup={hasSub ? 'menu' : undefined}
            aria-expanded={hasSub ? expanded : undefined}
            onMouseEnter={(e) => {
              if (item.disabled) return;
              e.currentTarget.focus({ preventScroll: true });
              if (level === 'root' && !isPhone)
                setOpenSub(hasSub ? { key: item.key, focus: false } : null);
            }}
            onKeyDown={(e) => {
              if (hasSub && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                e.stopPropagation();
                setOpenSub({ key: item.key, focus: true });
              }
            }}
            onClick={() => {
              if (hasSub) return setOpenSub({ key: item.key, focus: true });
              close();
              item.onSelect?.();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 max-md:py-3 text-left text-sm cursor-pointer outline-none transition-colors disabled:cursor-default ${
              item.disabled
                ? 'text-text-disabled'
                : item.danger
                  ? 'text-negative hover:bg-negative-subtle focus:bg-negative-subtle'
                  : `text-text hover:bg-hover focus:bg-hover ${expanded ? 'bg-hover' : ''}`
            }`}
          >
            {item.icon && <span className="shrink-0 flex items-center">{item.icon}</span>}
            <span className="flex-1 min-w-0">
              <span className="block truncate">{item.label}</span>
              {item.hint && (
                <span className="block text-xs text-text-tertiary truncate">{item.hint}</span>
              )}
            </span>
            {hasSub && (
              <ChevronRight size={14} className="shrink-0 text-text-tertiary" aria-hidden />
            )}
          </button>
        </div>
      );
    });
  }

  const panel =
    'fixed z-[60] bg-surface border border-border rounded-md shadow-hover py-1 animate-menu-in';
  return createPortal(
    <>
      <div
        ref={rootRef}
        role="menu"
        aria-label={inPlace ? subItem.label : label}
        onKeyDown={(e) => onKeyDown(e, 'root')}
        onContextMenu={(e) => e.preventDefault()}
        className={panel}
        style={{
          width: WIDTH,
          left: rootPos?.left ?? at.x,
          top: rootPos?.top ?? at.y,
          visibility: rootPos ? 'visible' : 'hidden',
        }}
      >
        {inPlace ? (
          <>
            <div role="none">
              <button
                type="button"
                role="menuitem"
                onClick={backToRoot}
                className="w-full flex items-center gap-2 px-3 py-3 text-left text-sm text-text-secondary hover:bg-hover focus:bg-hover outline-none cursor-pointer"
              >
                <ChevronLeft size={14} aria-hidden /> Back
              </button>
            </div>
            <div role="separator" className="my-1 border-t border-border" />
            {renderItems(subItem.submenu!, 'sub')}
          </>
        ) : (
          renderItems(items, 'root')
        )}
      </div>
      {subItem && !inPlace && (
        <div
          ref={subRef}
          role="menu"
          aria-label={subItem.label}
          onKeyDown={(e) => onKeyDown(e, 'sub')}
          onContextMenu={(e) => e.preventDefault()}
          className={panel}
          style={{
            width: WIDTH,
            left: subPos?.left ?? 0,
            top: subPos?.top ?? 0,
            visibility: subPos ? 'visible' : 'hidden',
          }}
        >
          {renderItems(subItem.submenu!, 'sub')}
        </div>
      )}
    </>,
    document.body,
  );
}

const enabledItems = (list: HTMLElement | null) =>
  Array.from(
    list?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
  ).filter((el) => el.closest('[role="menu"]') === list);

const firstItem = (list: HTMLElement | null) => enabledItems(list)[0];

function move(list: HTMLElement | null, key: string) {
  const all = enabledItems(list);
  if (!all.length) return;
  const at = all.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? all.length - 1
        : key === 'ArrowDown'
          ? (at + 1) % all.length
          : (at - 1 + all.length) % all.length;
  all[next].focus();
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

/**
 * Events that open a menu for an element: right-click, Shift+F10 or the Menu key while it (or
 * something in it) has focus, and a long press on a touch screen. Text fields keep their own
 * menu. Spread the result on the element; it works on a `display: contents` wrapper too.
 */
export function useMenuTrigger(open: (at: MenuPoint) => void) {
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const fromElement = (el: Element): MenuPoint => {
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(24, r.width / 2), y: r.top + Math.min(r.height, 40) };
  };
  const ownMenu = (t: EventTarget) =>
    t instanceof HTMLElement && (t.isContentEditable || !!t.closest('input, textarea, select'));
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };
  return {
    onContextMenu(e: React.MouseEvent) {
      if (ownMenu(e.target)) return;
      e.preventDefault();
      if (press.current?.fired) return; // already opened by the long press
      if (press.current) {
        // The browser's own long-press menu came first: don't open a second time
        cancel();
        press.current.fired = true;
      }
      // A keyboard-opened menu has no pointer position: open it by the focused element
      const keyboard = e.clientX === 0 && e.clientY === 0;
      open(keyboard ? fromElement(e.target as Element) : { x: e.clientX, y: e.clientY });
    },
    onKeyDown(e: React.KeyboardEvent) {
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        if (ownMenu(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        open(fromElement(e.target as Element));
      }
    },
    onTouchStart(e: React.TouchEvent) {
      if (e.touches.length !== 1 || ownMenu(e.target)) return;
      cancel();
      const { clientX: x, clientY: y } = e.touches[0];
      press.current = {
        x,
        y,
        fired: false,
        timer: window.setTimeout(() => {
          if (!press.current) return;
          press.current.fired = true;
          navigator.vibrate?.(10);
          open({ x, y });
        }, LONG_PRESS_MS),
      };
    },
    onTouchMove(e: React.TouchEvent) {
      const p = press.current;
      const t = e.touches[0];
      if (p && !p.fired && t && Math.hypot(t.clientX - p.x, t.clientY - p.y) > LONG_PRESS_SLOP) {
        cancel();
        press.current = null;
      }
    },
    onTouchEnd(e: React.TouchEvent) {
      cancel();
      // The tap that ends a long press doesn't also open the transaction
      if (press.current?.fired) e.preventDefault();
      window.setTimeout(() => (press.current = null), 0);
    },
    onTouchCancel() {
      cancel();
      press.current = null;
    },
  };
}

/**
 * Wraps an element (a register row, say) so right-click, Shift+F10, the Menu key and a long
 * press open a menu for it, without adding a box to the layout.
 */
export function MenuTarget({
  onOpen,
  children,
}: {
  onOpen: (at: MenuPoint) => void;
  children: ReactNode;
}) {
  const trigger = useMenuTrigger(onOpen);
  return (
    <div className="contents" {...trigger}>
      {children}
    </div>
  );
}

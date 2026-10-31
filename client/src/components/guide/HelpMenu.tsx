import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { BookOpen, CircleHelp, Compass, ListChecks, MapPin } from 'lucide-react';
import { GUIDES } from '../../guides';
import { useGuideStore } from '../../store/guideStore';
import { guideForPage } from '../../utils/guides';
import { DOCS_URL } from '../../utils/project';

const MENU_WIDTH = 240;

/**
 * The sidebar's ? button: this page's guide, the welcome tour, every guide and tip setting,
 * and the online guide. The list opens outside the sidebar so a narrow sidebar can't clip it.
 */
export function HelpMenu({
  className,
  children,
}: {
  className: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const { pathname } = useLocation();
  const pageGuide = guideForPage(pathname, GUIDES);
  const start = useGuideStore((s) => s.start);
  const setListOpen = useGuideStore((s) => s.setListOpen);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setPosition({
      top: r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The phone menu closes on Escape too; this list goes first
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // Following a link closes it
  useEffect(() => setOpen(false), [pathname]);

  const item =
    'w-full flex items-center gap-2.5 px-3 py-2 max-md:min-h-11 text-left text-sm text-text hover:bg-hover rounded-md';
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Help and guides"
        data-guide="nav.help"
        className={className}
      >
        <CircleHelp size={16} aria-hidden />
        {/* The hover label, kept out of the way of the open list */}
        {!open && children}
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="group"
            aria-label="Help and guides"
            className="fixed z-50 p-1.5 rounded-lg border border-border bg-surface shadow-lg"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          >
            {pageGuide && (
              <button type="button" className={item} onClick={choose(() => start(pageGuide.id))}>
                <MapPin size={15} className="text-text-tertiary shrink-0" aria-hidden />
                Guide for this page
              </button>
            )}
            <button type="button" className={item} onClick={choose(() => start('welcome'))}>
              <Compass size={15} className="text-text-tertiary shrink-0" aria-hidden />
              Take the welcome tour
            </button>
            <button type="button" className={item} onClick={choose(() => setListOpen(true))}>
              <ListChecks size={15} className="text-text-tertiary shrink-0" aria-hidden />
              All guides and tips
            </button>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
              onClick={() => setOpen(false)}
            >
              <BookOpen size={15} className="text-text-tertiary shrink-0" aria-hidden />
              Read the online guide
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}

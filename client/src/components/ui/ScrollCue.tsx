import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A row that scrolls sideways (tab bars on a phone). When part of it is off screen, a fade
 * and an arrow on that edge say so, so a tab cut off at the edge doesn't read as the last one.
 */
export function ScrollCue({
  children,
  className = '',
  scrollerClassName = '',
  activeKey,
}: {
  children: ReactNode;
  /** Classes for the outer box (borders, margins, max width) */
  className?: string;
  /** Classes for the scrolling row itself (flex, gap) */
  scrollerClassName?: string;
  /**
   * The chosen item's key. When it changes, the row scrolls so the child marked
   * data-scroll-active is in view, clear of the fade, rather than hidden past the edge.
   */
  activeKey?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setMore({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    for (const child of Array.from(el.children)) observer?.observe(child);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[data-scroll-active="true"]');
    if (!el || !active) return;
    // Only the row scrolls: scrollIntoView could also move the page
    const clear = 40; // the fade's width
    const start =
      active.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    const end = start + active.getBoundingClientRect().width;
    if (start - clear < el.scrollLeft) el.scrollLeft = Math.max(0, start - clear);
    else if (end + clear > el.scrollLeft + el.clientWidth)
      el.scrollLeft = end + clear - el.clientWidth;
  }, [activeKey]);

  const fade = 'pointer-events-none absolute inset-y-0 w-10 flex items-center text-text-tertiary';
  return (
    <div data-testid="scroll-cue" className={`relative ${className}`}>
      <div
        ref={scroller}
        data-testid="scroll-cue-scroller"
        className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${scrollerClassName}`}
      >
        {children}
      </div>
      {more.left && (
        <span
          aria-hidden
          data-testid="scroll-cue-left"
          className={`${fade} left-0 justify-start bg-gradient-to-r from-surface to-transparent`}
        >
          <ChevronLeft size={16} />
        </span>
      )}
      {more.right && (
        <span
          aria-hidden
          data-testid="scroll-cue-right"
          className={`${fade} right-0 justify-end bg-gradient-to-l from-surface to-transparent`}
        >
          <ChevronRight size={16} />
        </span>
      )}
    </div>
  );
}

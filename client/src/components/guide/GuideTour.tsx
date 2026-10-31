import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { guideById, type Guide } from '../../guides';
import { useGuideStore } from '../../store/guideStore';
import { useUpdateGuides } from '../../hooks/useGuides';
import { useIsPhone } from '../../hooks/useIsPhone';
import { Button } from '../ui/Button';
import {
  guideClosedUpdate,
  placeCard,
  spotlightRect,
  type CardPlacement,
  type Rect,
} from '../../utils/guides';

// The guide being shown (docs/GUIDES.md): the screen dims, the step's element is highlighted
// and a card explains it. While it's open the app behind is inert, so nothing on the page can
// be changed by accident; Escape or the close button leaves at any step.

/** How long to wait for a step's element to appear (its page loading) before going on without */
const FIND_MS = 3000;

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** On screen, not in the closed phone menu or a collapsed sidebar's hidden buttons */
function isShown(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.right <= 0 || r.left >= window.innerWidth) return false;
  const inert = el.parentElement?.closest('[inert]');
  // The app root is made inert by the guide itself
  if (inert && inert.id !== 'root') return false;
  if (
    typeof el.checkVisibility === 'function' &&
    !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  )
    return false;
  return true;
}

/** The first shown element with one of these markers, and whether any exists at all */
function findTarget(ids: string[]): { el: HTMLElement | null; exists: boolean } {
  let exists = false;
  for (const id of ids) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-guide="${id}"]`)) {
      exists = true;
      if (isShown(el)) return { el, exists };
    }
  }
  return { el: null, exists };
}

type View = { status: 'searching' } | { status: 'found'; rect: Rect } | { status: 'missing' };

export function GuideTour() {
  const active = useGuideStore((s) => s.active);
  const guide = active ? guideById(active.guideId) : undefined;
  const touring = !!guide;

  // While a guide is open: the app behind can't be used, and focus returns afterwards
  useEffect(() => {
    if (!touring) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    if (root) root.inert = true;
    return () => {
      if (root) root.inert = false;
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [touring]);

  if (!active || !guide) return null;
  const index = Math.min(active.step, guide.steps.length - 1);
  return <TourStep key={`${guide.id}:${index}`} guide={guide} index={index} />;
}

function TourStep({ guide, index }: { guide: Guide; index: number }) {
  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;
  const goTo = useGuideStore((s) => s.goTo);
  const stop = useGuideStore((s) => s.stop);
  const update = useUpdateGuides();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPhone = useIsPhone();
  const titleId = useId();
  const bodyId = useId();
  const card = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<View>({ status: 'searching' });
  const [cardSize, setCardSize] = useState({ width: 340, height: 200 });
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const close = (finished: boolean) => {
    update.mutate(guideClosedUpdate(guide, finished));
    stop();
  };
  const next = () => (last ? close(true) : goTo(index + 1));
  const back = () => index > 0 && goTo(index - 1);

  // Open the step's page, once
  const navigated = useRef(false);
  useEffect(() => {
    if (navigated.current || !step.route) return;
    navigated.current = true;
    if (pathRef.current !== step.route) navigate(step.route);
  }, [step.route, navigate]);

  // Find the step's element once its page is showing, then follow it as the page scrolls
  // or resizes
  useEffect(() => {
    const ids = step.target ? [step.target].flat() : [];
    const started = performance.now();
    let el: HTMLElement | null = null;
    let scrolled = false;
    let last = '';
    let frame = 0;
    const tick = () => {
      if (el && !el.isConnected) el = null;
      const onPage = !step.route || pathRef.current === step.route;
      let missing = ids.length === 0;
      if (!el && ids.length && onPage) {
        const found = findTarget(ids);
        el = found.el;
        // There, but hidden on this screen (the phone menu): no point waiting
        if (!el && found.exists) missing = true;
        if (el && !scrolled) {
          scrolled = true;
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
          el.scrollIntoView({
            block: tall ? 'start' : 'center',
            inline: 'nearest',
            behavior: reducedMotion() ? 'auto' : 'smooth',
          });
        }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        const key = [r.top, r.left, r.width, r.height].map(Math.round).join(',');
        if (key !== last) {
          last = key;
          setView({
            status: 'found',
            rect: { top: r.top, left: r.left, width: r.width, height: r.height },
          });
        }
      } else if (missing || performance.now() - started > FIND_MS) {
        if (last !== 'missing') {
          last = 'missing';
          setView({ status: 'missing' });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The card's own size decides where it fits
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const { offsetWidth: width, offsetHeight: height } = el;
    if (width !== cardSize.width || height !== cardSize.height) setCardSize({ width, height });
  });

  // Each step is announced: focus goes to its title
  const ready = view.status !== 'searching';
  useEffect(() => {
    if (ready) title.current?.focus({ preventScroll: true });
  }, [ready]);

  // Keys: Escape leaves, arrows step, Tab stays in the card. Nothing reaches the app's own
  // shortcuts (undo, Safe mode) while a guide is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab' && card.current) {
        const items = [
          ...card.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
        ];
        if (!items.length) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        const current = document.activeElement;
        if (!card.current.contains(current)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (current === first || current === title.current)) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && current === lastItem) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  const target = view.status === 'found' ? view.rect : null;
  let placement: CardPlacement = placeCard(target, cardSize, viewport, isPhone);
  if (isPhone && placement.mode === 'center') placement = { mode: 'sheet', edge: 'bottom' };
  const spot = target && spotlightRect(target, viewport);
  const body = (isPhone && step.phoneBody) || step.body;
  const isWelcome = guide.id === 'welcome';

  const cardStyle: CSSProperties =
    placement.mode === 'float'
      ? { top: placement.top, left: placement.left }
      : placement.mode === 'sheet'
        ? placement.edge === 'top'
          ? { top: 0, left: 0, right: 0 }
          : { bottom: 0, left: 0, right: 0 }
        : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const cardShape =
    placement.mode === 'sheet'
      ? `w-full ${placement.edge === 'top' ? 'rounded-b-xl pt-[max(1rem,env(safe-area-inset-top))]' : 'rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]'}`
      : 'w-[340px] max-w-[calc(100vw-32px)] rounded-xl';

  return createPortal(
    // Catches every click: the page behind waits until the guide is closed
    <div className="fixed inset-0 z-[60]" data-testid="guide-tour">
      {spot ? (
        <div
          aria-hidden
          className="absolute rounded-lg ring-2 ring-brand-500 pointer-events-none motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
          style={{ ...spot, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/45" />
      )}
      {ready && (
        <div
          ref={card}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={`fixed bg-surface border border-border shadow-modal p-4 motion-safe:animate-fade-in ${cardShape}`}
          style={cardStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-text-tertiary pt-1">
              {guide.title} · Step {index + 1} of {guide.steps.length}
            </p>
            <button
              type="button"
              onClick={() => close(false)}
              aria-label={isWelcome ? 'Skip tour' : 'Close guide'}
              className="-mr-1.5 -mt-1 p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:bg-hover hover:text-text"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <h2
            id={titleId}
            ref={title}
            tabIndex={-1}
            className="mt-1 text-base font-semibold text-text outline-none"
          >
            {step.title}
          </h2>
          <p id={bodyId} className="mt-1.5 text-sm text-text-secondary leading-relaxed">
            {body}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div aria-hidden className="flex flex-1 flex-wrap gap-1">
              {guide.steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brand-600' : 'bg-border'}`}
                />
              ))}
            </div>
            {index === 0 && isWelcome ? (
              <Button variant="ghost" size="sm" onClick={() => close(false)}>
                Not now
              </Button>
            ) : (
              index > 0 && (
                <Button variant="ghost" size="sm" onClick={back}>
                  Back
                </Button>
              )
            )}
            <Button size="sm" onClick={next}>
              {last ? 'Done' : index === 0 && isWelcome ? 'Start tour' : 'Next'}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

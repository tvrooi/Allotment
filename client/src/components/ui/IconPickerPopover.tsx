import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORY_ICONS } from '../../utils/categoryIcons';

const WIDTH = 320;
const HEIGHT = 300;
const MIN_HEIGHT = 200;
const GAP = 4;
const EDGE = 8;

interface Position {
  top: number;
  left: number;
  height: number;
}

/** Below the anchor when it fits, else above, else on the roomier side, shortened to fit */
function placeBeside(anchor: DOMRect): Position {
  const below = window.innerHeight - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - WIDTH - EDGE));
  if (below >= HEIGHT || below >= above) {
    return {
      top: anchor.bottom + GAP,
      left,
      height: Math.max(MIN_HEIGHT, Math.min(HEIGHT, below)),
    };
  }
  const height = Math.max(MIN_HEIGHT, Math.min(HEIGHT, above));
  return { top: anchor.top - GAP - height, left, height };
}

/**
 * Icon picker opened from a button (`anchorRef`): the app's own line icons, so every category
 * looks alike (no emoji). Gives back the icon's name. It's portaled to the body so a card with
 * `overflow-hidden` or a dialog can't cut it off. Closes on a click outside it, on the anchor
 * or on Escape.
 */
export function IconPickerPopover({
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  useLayoutEffect(() => {
    function place() {
      if (anchorRef.current) setPos(placeBeside(anchorRef.current.getBoundingClientRect()));
    }
    place();
    window.addEventListener('resize', place);
    // Follow the anchor when the page or a dialog scrolls (scrolling inside the picker is ignored)
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) place();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // The anchor toggles the picker itself
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [anchorRef, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose an icon"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed z-[60] overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-hover"
      style={{ top: pos.top, left: pos.left, width: WIDTH, maxHeight: pos.height }}
    >
      <div className="grid grid-cols-8 gap-1">
        {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
          <button
            key={name}
            type="button"
            title={name.replace(/([a-z])([A-Z0-9])/g, '$1 $2')}
            aria-label={name.replace(/([a-z])([A-Z0-9])/g, '$1 $2')}
            onClick={() => {
              onSelect(name);
              onClose();
            }}
            className="flex aspect-square items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <Icon size={18} aria-hidden />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

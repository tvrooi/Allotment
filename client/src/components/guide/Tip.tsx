import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { GUIDES, type TipDef } from '../../guides';
import { useGuideProgress, useUpdateGuides } from '../../hooks/useGuides';
import { useIsPhone } from '../../hooks/useIsPhone';
import { useGuideStore } from '../../store/guideStore';
import { bannerFor, tipVisible } from '../../utils/guides';

/**
 * A short tip, in the flow of the page (it never covers anything). Shown once while tips are
 * on (Settings → Preferences), one per page at a time, and not while the page offers a guide.
 */
export function Tip({
  tip,
  desktopOnly = false,
  className = '',
}: {
  tip: TipDef;
  /** About a keyboard shortcut: not on phones */
  desktopOnly?: boolean;
  className?: string;
}) {
  const progress = useGuideProgress().data;
  const update = useUpdateGuides();
  const isPhone = useIsPhone();
  const touring = useGuideStore((s) => !!s.active);
  const { pathname } = useLocation();
  const shown = useGuideStore((s) => s.shownTip === tip.id);
  const claimTip = useGuideStore((s) => s.claimTip);
  const releaseTip = useGuideStore((s) => s.releaseTip);
  // One thing at a time: not while the page offers a guide
  const eligible =
    tipVisible(tip.id, progress) &&
    !(desktopOnly && isPhone) &&
    !bannerFor(pathname, progress, GUIDES, touring);

  useEffect(() => {
    if (!eligible) return;
    claimTip(tip.id);
    return () => releaseTip(tip.id);
  }, [eligible, tip.id, claimTip, releaseTip]);

  if (!eligible || !shown || touring) return null;
  const link =
    'shrink-0 text-xs font-medium text-brand-700 hover:underline max-md:min-h-11 max-md:px-1';
  return (
    <div
      role="note"
      aria-label="Tip"
      className={`flex items-start gap-3 bg-brand-50 text-sm text-text-secondary ${className}`}
    >
      <Lightbulb size={16} className="text-brand-600 shrink-0 mt-0.5" aria-hidden />
      <p className="flex-1 min-w-0">{tip.text}</p>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <button
          type="button"
          className={link}
          onClick={() => update.mutate({ dismissedTips: [tip.id] })}
        >
          Got it
        </button>
        <button
          type="button"
          className={link}
          onClick={() => update.mutate({ tipsEnabled: false })}
        >
          Turn off tips
        </button>
      </div>
    </div>
  );
}

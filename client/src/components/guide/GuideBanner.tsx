import { useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { GUIDES } from '../../guides';
import { useGuideProgress, useUpdateGuides } from '../../hooks/useGuides';
import { useGuideStore } from '../../store/guideStore';
import { bannerFor } from '../../utils/guides';
import { Button } from '../ui/Button';

/**
 * One line above the page, never over it: the welcome tour for a new budget, where guides are
 * for people who were here before them, or a page's own guide on a first visit.
 */
export function GuideBanner() {
  const { pathname } = useLocation();
  const progress = useGuideProgress().data;
  const touring = useGuideStore((s) => !!s.active);
  const start = useGuideStore((s) => s.start);
  const setListOpen = useGuideStore((s) => s.setListOpen);
  const update = useUpdateGuides();
  const banner = bannerFor(pathname, progress, GUIDES, touring);
  if (!banner) return null;

  let text: string;
  let primary: { label: string; onClick: () => void };
  let secondary: { label: string; onClick: () => void };
  if (banner.kind === 'welcome') {
    text =
      'New to Allotment? A two-minute tour shows the basics. You can take it later from the ? button.';
    primary = { label: 'Take the tour', onClick: () => start('welcome') };
    secondary = { label: 'Not now', onClick: () => update.mutate({ welcomeTour: 'dismissed' }) };
  } else if (banner.kind === 'notice') {
    text =
      'New: guides and tips. Take a tour or a page’s guide from the ? button, and turn tips on in Settings → Preferences.';
    primary = {
      label: 'See the guides',
      onClick: () => {
        update.mutate({ guidesNotice: false });
        setListOpen(true);
      },
    };
    secondary = { label: 'Got it', onClick: () => update.mutate({ guidesNotice: false }) };
  } else {
    const { guide } = banner;
    text = banner.updated
      ? `The guide to this page has changed: ${guide.summary}`
      : `First time here? A short guide shows how it works: ${guide.summary}`;
    primary = { label: 'Show me', onClick: () => start(guide.id) };
    secondary = {
      label: 'No thanks',
      onClick: () => update.mutate({ seenGuides: { [guide.id]: guide.version } }),
    };
  }

  return (
    <section
      aria-label="Guide"
      data-testid="guide-banner"
      className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-6 max-md:px-4 py-2.5 bg-brand-50 border-b border-border-light text-sm text-text-secondary"
    >
      <Compass size={16} className="text-brand-600 shrink-0" aria-hidden />
      <p className="flex-1 min-w-[12rem]">{text}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="ghost" onClick={secondary.onClick}>
          {secondary.label}
        </Button>
        <Button size="sm" onClick={primary.onClick}>
          {primary.label}
        </Button>
      </div>
    </section>
  );
}

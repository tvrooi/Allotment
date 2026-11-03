import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Compass, Download, House, Loader2, RotateCcw } from 'lucide-react';
import { IS_DEMO, resetDemo } from '../../demo/demoApi';
import { useGuideProgress } from '../../hooks/useGuides';
import { useGuideStore } from '../../store/guideStore';

/** Allotment's releases on GitHub: the desktop installers and the Home Assistant app */
export const DOWNLOAD_URL = 'https://github.com/tvrooi/Allotment/releases/latest';
/** Allotment's home: its README on GitHub */
export const HOME_URL = 'https://github.com/tvrooi/Allotment#readme';

/**
 * The demo ("Try the demo"): one strip that says this is a sample budget that isn't saved,
 * offers the two-minute tour, starting over, Allotment's home page and the download. On a
 * phone it's a single slim line. Renders nothing outside the demo build.
 */
export function DemoBanner() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const progress = useGuideProgress().data;
  const touring = useGuideStore((s) => !!s.active);
  const startGuide = useGuideStore((s) => s.start);
  if (!IS_DEMO) return null;

  async function startOver() {
    setResetting(true);
    try {
      await resetDemo();
      qc.removeQueries();
      navigate('/dashboard');
    } finally {
      setResetting(false);
    }
  }

  const button =
    'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap';
  const quiet = `${button} border border-border bg-surface text-text-secondary hover:text-text hover:bg-surface-alt`;
  const offerTour = !touring && progress?.welcomeTour !== 'done';
  return (
    <div
      role="region"
      aria-label="Demo"
      className="shrink-0 flex items-center gap-3 px-4 max-md:px-3 py-2 max-md:py-0 max-md:h-9 text-sm max-md:text-xs bg-brand-50 text-text border-b border-brand-200"
    >
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium">Demo</span>
        <span className="text-text-secondary">
          {' · '}
          <span className="md:hidden">nothing saved</span>
          <span className="max-md:hidden">
            a sample budget from Up. Change anything; nothing is saved.
          </span>
        </span>
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {offerTour && (
          <button
            type="button"
            onClick={() => startGuide('welcome')}
            className={`${quiet} max-md:hidden`}
          >
            <Compass size={14} aria-hidden />
            Take the 2-minute tour
          </button>
        )}
        <button
          type="button"
          onClick={() => void startOver()}
          disabled={resetting}
          title="Start over with the original demo budget"
          className={`${quiet} max-md:hidden disabled:opacity-50`}
        >
          {resetting ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <RotateCcw size={14} aria-hidden />
          )}
          Start over
        </button>
        <a href={HOME_URL} className={`${quiet} max-md:hidden`}>
          <House size={14} aria-hidden />
          Back to home
        </a>
        <a
          href={DOWNLOAD_URL}
          className={`${button} max-md:px-2 max-md:py-0.5 bg-brand-600 text-brand-contrast hover:bg-brand-700`}
        >
          <Download size={14} aria-hidden />
          Download<span className="max-md:hidden"> Allotment</span>
        </a>
      </div>
    </div>
  );
}

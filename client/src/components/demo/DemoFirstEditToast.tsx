import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { IS_DEMO, onFirstDemoEdit } from '../../demo/demoApi';
import { DOWNLOAD_URL } from './DemoBanner';

/**
 * The demo's first change (an assignment, a category, a new transaction): a moment's note that
 * it worked but won't be kept, with the way to a real budget. Once per visit; it goes by itself.
 */
export function DemoFirstEditToast() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!IS_DEMO) return;
    return onFirstDemoEdit(() => setOpen(true));
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 12_000);
    return () => clearTimeout(timer);
  }, [open]);
  if (!open) return null;
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-lg bg-surface border border-border shadow-hover px-4 py-3 text-sm text-text max-w-md"
    >
      <p className="flex-1">
        Nice, that worked. The demo doesn’t keep it, though: download Allotment to keep a real
        budget.
      </p>
      <a
        href={DOWNLOAD_URL}
        className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 max-md:min-h-11 text-xs font-medium rounded-md bg-brand-600 text-brand-contrast hover:bg-brand-700"
      >
        <Download size={14} aria-hidden /> Download
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
        className="p-1 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded text-text-tertiary hover:text-text"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

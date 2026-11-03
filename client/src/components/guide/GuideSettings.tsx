import { useState } from 'react';
import { useGuideProgress, useResetGuides, useUpdateGuides } from '../../hooks/useGuides';
import { useGuideStore } from '../../store/guideStore';
import { Button } from '../ui/Button';

const pressed = (on: boolean) =>
  `px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer max-md:min-h-11 ${
    on
      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
      : 'border-border bg-surface text-text-secondary hover:border-border'
  }`;

/** Tips and page guides on or off, and starting over. Settings → Preferences and the guides list. */
export function GuideSettings({ showList = true }: { showList?: boolean }) {
  const progress = useGuideProgress();
  const update = useUpdateGuides();
  const reset = useResetGuides();
  const start = useGuideStore((s) => s.start);
  const setListOpen = useGuideStore((s) => s.setListOpen);
  const [resetDone, setResetDone] = useState(false);

  if (progress.isError)
    return (
      <p className="text-xs text-text-tertiary">
        Guides aren’t available right now. They need the server to be reachable and up to date.
      </p>
    );
  const data = progress.data;
  if (!data) return null;

  const rows = [
    {
      key: 'tips',
      label: 'Show tips',
      description: 'Short tips on a page, once each. One at a time.',
      value: data.tipsEnabled,
      set: (v: boolean) => update.mutate({ tipsEnabled: v }),
    },
    {
      key: 'pages',
      label: 'Offer a page’s guide',
      description: 'The first time you open a page that has one.',
      value: data.pageGuidesEnabled,
      set: (v: boolean) => update.mutate({ pageGuidesEnabled: v }),
    },
  ];

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-text">{row.label}</div>
            <div className="text-xs text-text-tertiary mt-0.5">{row.description}</div>
          </div>
          <div role="group" aria-label={row.label} className="flex gap-2 shrink-0">
            {[
              { v: true, l: 'On' },
              { v: false, l: 'Off' },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                aria-pressed={row.value === opt.v}
                onClick={() => row.set(opt.v)}
                className={pressed(row.value === opt.v)}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="secondary" onClick={() => start('welcome')}>
          Take the welcome tour
        </Button>
        {showList && (
          <Button size="sm" variant="secondary" onClick={() => setListOpen(true)}>
            See all guides
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={reset.isPending}
          onClick={() => reset.mutate(undefined, { onSuccess: () => setResetDone(true) })}
        >
          Reset tips and guides
        </Button>
        <span role="status" className="text-xs text-text-tertiary">
          {resetDone && 'Every tip and guide will show again.'}
        </span>
      </div>
    </div>
  );
}

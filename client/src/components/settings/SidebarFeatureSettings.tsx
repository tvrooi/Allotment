import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGuideProgress, useUpdateGuides } from '../../hooks/useGuides';
import { NAV_FEATURES } from '../../utils/navFeatures';
import type { NavChoice } from '../../api/guides';

type Choice = NavChoice | 'auto';
const CHOICES: { value: Choice; label: string }[] = [
  { value: 'auto', label: 'When in use' },
  { value: 'shown', label: 'Always' },
  { value: 'hidden', label: 'Hidden' },
];

/**
 * Which optional features the menu lists (audit decision I-4). Saved with the budget, so the
 * choice follows the person to every device. A hidden feature's page still opens from a link.
 */
export function SidebarFeatureSettings() {
  const { data: progress, isError } = useGuideProgress();
  const update = useUpdateGuides();
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const focusHere = (location.state as { focus?: string } | null)?.focus === 'sidebar-features';
  useEffect(() => {
    if (!focusHere || !heading.current) return;
    heading.current.scrollIntoView({ block: 'center' });
    heading.current.focus();
  }, [focusHere, progress]);

  if (isError) return null;
  return (
    <section aria-labelledby="sidebar-features" className="space-y-3">
      <div>
        <h4
          id="sidebar-features"
          ref={heading}
          tabIndex={-1}
          className="text-sm font-medium text-text outline-none"
        >
          Show in the menu
        </h4>
        <p className="text-xs text-text-tertiary mt-0.5">
          These appear once they hold something. Their pages always open from a link.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {NAV_FEATURES.map((f) => {
          const choice: Choice = progress?.navFeatures?.[f.key] ?? 'auto';
          const inUse = progress?.featuresInUse?.includes(f.key);
          return (
            <li key={f.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">{f.label}</p>
                <p className="text-xs text-text-tertiary">
                  {f.description}
                  {choice === 'auto' && (inUse ? ' · in use, shown' : ' · not in use yet')}
                </p>
              </div>
              <div role="radiogroup" aria-label={`${f.label} in the menu`} className="flex gap-1">
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={choice === c.value}
                    disabled={!progress}
                    onClick={() => update.mutate({ navFeatures: { [f.key]: c.value } })}
                    className={`px-2.5 py-1 max-md:min-h-11 rounded-md border text-xs ${
                      choice === c.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-border bg-surface text-text-secondary hover:border-border'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

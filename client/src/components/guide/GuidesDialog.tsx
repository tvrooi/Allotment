import { Check } from 'lucide-react';
import { GUIDES } from '../../guides';
import { useGuideProgress } from '../../hooks/useGuides';
import { useIsPhone } from '../../hooks/useIsPhone';
import { useGuideStore } from '../../store/guideStore';
import { guideStatus } from '../../utils/guides';
import { DOCS_URL } from '../../utils/project';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ExternalLink } from '../ui/ExternalLink';
import { GuideSettings } from './GuideSettings';

/** Every guide, to take (again), with the tip settings: the ? menu, or ? on the keyboard */
export function GuidesDialog() {
  const open = useGuideStore((s) => s.listOpen);
  const setListOpen = useGuideStore((s) => s.setListOpen);
  const start = useGuideStore((s) => s.start);
  const progress = useGuideProgress().data;
  const isPhone = useIsPhone();

  return (
    <Modal isOpen={open} onClose={() => setListOpen(false)} title="Guides and tips" size="lg">
      <ul className="divide-y divide-border-light -mt-2">
        {GUIDES.map((guide) => {
          const status = progress ? guideStatus(guide, progress) : 'new';
          return (
            <li key={guide.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-text">
                  {guide.title}
                  {status === 'seen' && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-normal text-text-tertiary">
                      <Check size={12} aria-hidden /> Seen
                    </span>
                  )}
                  {status === 'updated' && (
                    <span className="text-xs font-normal text-brand-700">Updated</span>
                  )}
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">{guide.summary}</p>
              </div>
              <Button
                size="sm"
                variant={status === 'seen' ? 'secondary' : 'primary'}
                aria-label={`${status === 'seen' ? 'Take again' : 'Start'}: ${guide.title}`}
                onClick={() => start(guide.id)}
              >
                {status === 'seen' ? 'Take again' : 'Start'}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 pt-4 border-t border-border">
        <GuideSettings showList={false} />
      </div>
      <p className="mt-4 text-xs text-text-tertiary">
        Want more detail?{' '}
        <ExternalLink href={DOCS_URL} className="text-brand-700 hover:underline">
          Read the online guide
        </ExternalLink>
        .{!isPhone && ' Press ? at any time to open this list.'}
      </p>
    </Modal>
  );
}

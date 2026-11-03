import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Private } from '../ui/Private';
import { useNextSteps } from '../../hooks/useNextSteps';
import { formatCurrency } from '../../utils/currency';

/** The Review page's one list to work through, most urgent first */
export function DoThisNext() {
  const steps = useNextSteps();
  return (
    <Card>
      <h2 className="text-base font-semibold text-text">Do this next</h2>
      {steps.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <CheckCircle2 size={16} className="text-positive" aria-hidden /> Nothing needs you right
          now. Every dollar has a job.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-border-light">
          {steps.map((step, i) => (
            <li key={step.id}>
              <Link to={step.to} className="flex items-center gap-3 py-3 max-md:min-h-11 group">
                <span
                  aria-hidden
                  className={`w-6 h-6 shrink-0 rounded-full text-xs font-semibold flex items-center justify-center ${i === 0 ? 'bg-brand-600 text-brand-contrast' : 'bg-surface-alt text-text-tertiary'}`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-text group-hover:text-brand-700">
                  {step.title}
                </span>
                {step.amount !== undefined && (
                  <span className="text-sm tabular-nums text-text-secondary">
                    <Private>{formatCurrency(step.amount)}</Private>
                  </span>
                )}
                <ChevronRight size={14} className="text-text-tertiary" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

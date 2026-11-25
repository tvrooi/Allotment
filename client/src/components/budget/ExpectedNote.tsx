import { useState } from 'react';
import { format } from 'date-fns';
import { Button as FundingButton } from '../ui/Button';
import { Link } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
  ProgressBar,
} from 'react-aria-components';
import { formatCurrency } from '../../utils/currency';
import { expectedFundingNote, nextExpectedFunding } from '../../utils/budgetFigures';
import { formatShortDay } from '../../utils/dates';
import type { BudgetCategory } from '../../types';

/** Recurring debits still to come. Opening the breakdown never changes the budget. */
export function ExpectedNote({
  cat,
  className = '',
  onAssign,
}: {
  cat: BudgetCategory;
  className?: string;
  /** Opens the existing editor; absent when assignment is unavailable. */
  onAssign?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const items = cat.expectedItems ?? [];
  const expected = cat.expected ?? 0;
  if (expected <= 0 || !items.length) return null;
  const covered = Math.min(Math.max(cat.balance, 0), expected);
  const after = cat.balance - expected;
  const funding = nextExpectedFunding(cat);
  const groups = funding
    ? [
        { title: `Due by ${formatShortDay(funding.date)}`, items: funding.items },
        {
          title: 'Later this month',
          items: items
            .filter((item) => item.date > funding.date)
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      ]
    : [{ title: 'Bills still expected', items }];
  const { label, overdue } = expectedFundingNote(cat, format(new Date(), 'yyyy-MM-dd'));
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        className={`ml-auto flex min-h-11 md:min-h-6 items-center justify-end gap-1 rounded-sm text-xs tabular-nums ${overdue ? 'text-negative hover:text-negative' : 'text-expected hover:text-text'} text-right underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${className}`}
        aria-label={`${cat.name}: ${label}${overdue ? ', overdue' : ''}. Show expected bills`}
        data-testid="expected-debit"
      >
        {label}
        <ChevronDown size={12} aria-hidden />
      </Button>
      <Popover
        placement="bottom end"
        offset={6}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-surface text-text shadow-card outline-none"
      >
        <Dialog
          className="max-h-[80dvh] overflow-y-auto p-4 outline-none"
          aria-label={`Expected bills for ${cat.name}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Heading slot="title" className="text-sm font-semibold">
                Expected bills
              </Heading>
              <p className="text-xs text-text-secondary break-words">
                {cat.name} · not debited yet
              </p>
            </div>
            <Button
              slot="close"
              aria-label="Close expected bills"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <X size={16} aria-hidden />
            </Button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between gap-3 text-xs text-text-secondary tabular-nums">
              <span>Covered by this envelope</span>
              <span className="shrink-0">
                {formatCurrency(covered)} / {formatCurrency(expected)}
              </span>
            </div>
            <ProgressBar
              aria-label="Expected bills covered"
              value={covered}
              maxValue={expected}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt"
            >
              <div
                className={`h-full rounded-full ${covered < expected ? 'bg-caution' : 'bg-chart-brand'}`}
                style={{ width: `${(covered / expected) * 100}%` }}
              />
            </ProgressBar>
          </div>
          {funding && (
            <section
              className="mt-4 border-t border-border-light pt-3"
              aria-label="Next funding gap"
            >
              <h3 className="text-sm font-medium">
                Next funding gap · {formatShortDay(funding.date)}
              </h3>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs tabular-nums">
                <dt className="text-text-secondary">Bills due by then</dt>
                <dd className="text-right">{formatCurrency(funding.due)}</dd>
                <dt className="text-text-secondary">Covered by this envelope</dt>
                <dd className="text-right">{formatCurrency(funding.covered)}</dd>
                <dt className={overdue ? 'text-negative' : 'text-caution'}>Still needed</dt>
                <dd
                  className={`text-right font-medium ${overdue ? 'text-negative' : 'text-caution'}`}
                >
                  {formatCurrency(funding.needed)}
                </dd>
              </dl>
            </section>
          )}
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.title} className="mt-4" aria-label={group.title}>
                <h3 className="mb-2 text-xs font-medium text-text-secondary">{group.title}</h3>
                <ul className="space-y-3">
                  {group.items.map((item, index) => (
                    <li
                      key={`${item.date}-${item.name}-${index}`}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/recurring?schedule=${encodeURIComponent(item.scheduleId)}`}
                          aria-label={`Open recurring bill: ${item.name}`}
                          className="block min-h-11 md:min-h-0 content-center break-words rounded-sm text-brand-700 underline underline-offset-2 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                        >
                          {item.name}
                        </Link>
                        <time dateTime={item.date} className="text-xs text-text-secondary">
                          {formatShortDay(item.date)}
                        </time>
                      </div>
                      <span className="shrink-0 tabular-nums">{formatCurrency(-item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          <div className="mt-4 border-t border-border-light pt-3 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-text-secondary">After expected bills</span>
            <span
              className={`font-medium tabular-nums ${after < 0 ? 'text-caution' : 'text-text'}`}
            >
              {formatCurrency(after)}
            </span>
          </div>
          {onAssign && (
            <FundingButton
              className="mt-3 w-full"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                // Let the popover restore focus before the amount editor takes it.
                requestAnimationFrame(onAssign);
              }}
            >
              Assign to {cat.name}…
            </FundingButton>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

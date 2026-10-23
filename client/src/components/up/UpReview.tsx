import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { acknowledgeUpReview, getUpReview, getUpRoundUps, type UpReviewItem } from '../../api/up';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { UpRoundUpCheck } from './UpRoundUpCheck';

function BankDetails({ source }: { source: UpReviewItem['current'] }) {
  return (
    <div className="space-y-1">
      <p>
        {source.description} · {formatMoney(source.amount, 'AUD')} · {source.status}
      </p>
      <p>
        Created: {source.createdAt} · Settled: {source.settledAt ?? 'Not settled'}
      </p>
      <p>
        Round-up: {formatMoney(-(source.roundUpAmount ?? 0), 'AUD')} · Includes boost:{' '}
        {formatMoney(-(source.boostAmount ?? 0), 'AUD')}
      </p>
      <p>
        Cashback: {formatMoney(source.cashbackAmount ?? 0, 'AUD')} {source.cashbackDescription}
      </p>
      <p>Transfer account: {source.transferAccountName ?? 'Not supplied'}</p>
      <p>{source.notes}</p>
    </div>
  );
}

export function UpReview({ canSave }: { canSave: boolean }) {
  const [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const review = useQuery({ queryKey: ['up-review', offset], queryFn: () => getUpReview(offset) });
  const rounds = useQuery({ queryKey: ['up-round-ups'], queryFn: getUpRoundUps });
  async function acknowledge(id: string, revision: number) {
    setBusy(true);
    setError(null);
    try {
      await acknowledgeUpReview(id, revision);
      await qc.invalidateQueries({ queryKey: ['up-review'] });
      if (offset > 0 && review.data?.items.length === 1) setOffset(Math.max(0, offset - 50));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review this item.');
      await qc.invalidateQueries({ queryKey: ['up-review'] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <section
        aria-label="Up review"
        className="rounded-lg border border-border bg-surface p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-text">
          Needs review{review.data ? ` (${review.data.total})` : ''}
        </h3>
        <p className="text-xs text-text-secondary">
          Review new imports and changes reported by Up. Acknowledging keeps your local transaction,
          categories, splits and reconciliation unchanged.
        </p>
        {review.isLoading && <p role="status">Loading review…</p>}
        {review.data && (
          <>
            <p className="text-xs text-text-secondary">
              {review.data.pending} pending bank transaction{review.data.pending === 1 ? '' : 's'}.
              Pending amounts are excluded from the register and round-up totals.
            </p>
            {review.data.total === 0 && (
              <p className="text-xs text-text-secondary">Nothing needs review.</p>
            )}
            <ul className="space-y-3">
              {review.data.items.map((item) => (
                <li
                  key={item.importedId}
                  className="border-t border-border pt-3 space-y-2 break-words"
                >
                  <p className="text-sm text-text">
                    {item.reviewState === 'new'
                      ? 'New import'
                      : item.reviewState === 'missing'
                        ? 'No longer returned by Up'
                        : 'Bank record changed'}{' '}
                    · {item.current.description}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {item.accountName} · {formatDay(item.current.createdAt.slice(0, 10))} ·{' '}
                    {formatMoney(item.current.amount, 'AUD')}
                  </p>
                  {item.reviewState === 'missing' && (
                    <p className="text-xs text-text-secondary">
                      The last complete bank response omitted this record. No local transaction was
                      removed.
                    </p>
                  )}
                  {item.reviewState === 'changed' && (
                    <details className="text-xs text-text-secondary">
                      <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
                        Compare bank observations
                      </summary>
                      <dl className="space-y-1 mt-2">
                        <dt>Previously reported</dt>
                        <dd>{item.previous && <BankDetails source={item.previous} />}</dd>
                        <dt>Now reported</dt>
                        <dd>
                          <BankDetails source={item.current} />
                        </dd>
                      </dl>
                    </details>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="text-xs underline text-text-secondary"
                      to={`/accounts/${item.accountId}`}
                    >
                      Open original register
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canSave || busy}
                      onClick={() => void acknowledge(item.importedId, item.revision)}
                    >
                      Acknowledge · keep local record
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={offset + 50 >= review.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </Button>
            </div>
          </>
        )}
        {(error || review.error) && (
          <p role="alert" className="text-xs text-negative">
            {error ?? review.error?.message}
          </p>
        )}
      </section>
      <UpRoundUpCheck canSave={canSave} />
      <section
        aria-label="Daily Up round-ups"
        className="rounded-lg border border-border bg-surface p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-text">Recent daily round-up details</h3>
        <p className="text-xs text-text-secondary">
          Amounts reported on settled purchases, including boosts. Saver credits are separate bank
          records; Up does not identify the matching purchase or destination here. These details do
          not add spending, income or transfers to your budget. Dates follow the bank’s timestamp.
          Late settlements and corrections can change earlier days.
        </p>
        {rounds.data?.days.length === 0 && (
          <p className="text-xs text-text-secondary">
            No round-up purchase details observed. Sync to collect bank details without changing
            existing imports.
          </p>
        )}
        {rounds.data?.days.map((day) => (
          <details
            key={day.date + day.accountId}
            className="text-xs text-text-secondary border-t border-border pt-2 break-words"
          >
            <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
              {formatDay(day.date)} · {day.accountName} · {formatMoney(day.amount, 'AUD')} reported
              · {day.purchases.length} purchase{day.purchases.length === 1 ? '' : 's'}
            </summary>
            <p className="mt-2">Includes {formatMoney(day.boost, 'AUD')} in boosts.</p>
            <ul className="mt-2 space-y-1">
              {day.purchases.map((p, i) => (
                <li key={p.transactionId ?? i}>
                  {p.description} · purchase {formatMoney(p.amount, 'AUD')} · round-up{' '}
                  {formatMoney(p.roundUpAmount, 'AUD')}
                </li>
              ))}
            </ul>
            <Link className="underline" to={`/accounts/${day.accountId}`}>
              Open original register
            </Link>
          </details>
        ))}
        {rounds.error && (
          <p role="alert" className="text-xs text-negative">
            {rounds.error.message}
          </p>
        )}
      </section>
    </div>
  );
}

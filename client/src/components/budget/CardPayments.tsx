import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/creditFunding';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency, parseCents, isUnreadableAmount } from '../../utils/currency';
import { Button } from '../ui/Button';
export function CardPayments({ month }: { month: string }) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(''),
    [amount, setAmount] = useState(''),
    [message, setMessage] = useState('');
  const [setup, setSetup] = useState<api.SetupPreview | null>(null),
    [funding, setFunding] = useState<api.FundingPreview | null>(null);
  const qc = useQueryClient(),
    canSave = useCanSave();
  const context = useQuery({
    queryKey: ['credit-cards', month],
    queryFn: () => api.getCards(month),
    enabled: open,
  });
  const editable = canSave && month === context.data?.today.slice(0, 7);
  const invalidate = () => {
    for (const key of ['budget', 'budget-summary', 'credit-cards', 'payday', 'category-history'])
      qc.invalidateQueries({ queryKey: [key] });
  };
  const mutation = useMutation({
    mutationFn: async (action: {
      kind: 'setup-preview' | 'setup-apply' | 'funding-preview' | 'funding-apply';
      id: string;
    }) => {
      setMessage('');
      if (action.kind === 'setup-preview') {
        setFunding(null);
        setSetup(await api.previewSetup(action.id));
        return;
      }
      if (action.kind === 'setup-apply') {
        await api.applySetup(action.id, setup!.revision);
        setSetup(null);
        setMessage('Card payment reserves enabled.');
        invalidate();
        return;
      }
      if (action.kind === 'funding-preview') {
        if (isUnreadableAmount(amount) || parseCents(amount) === 0)
          throw new Error('Enter a nonzero amount.');
        setSetup(null);
        setFunding(await api.previewFunding(action.id, parseCents(amount)));
        return;
      }
      await api.applyFunding(action.id, funding!.amount, funding!.revision);
      setFunding(null);
      setMessage('Card payment funding updated.');
      invalidate();
    },
    onError: (error: Error) => {
      setSetup(null);
      setFunding(null);
      setMessage(error.message);
    },
  });
  return (
    <div className="mb-4 text-sm">
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        Card payment funding
      </Button>
      {open && (
        <section aria-label="Card payment funding" className="mt-3 grid min-w-0 gap-3">
          <p>
            As of {context.data?.asOf}. Payment reserves are cash set aside to pay a card. Existing
            cards need a reviewed setup.
          </p>
          {context.isPending && <p>Loading cards…</p>}
          {context.error && <p role="alert">{context.error.message}</p>}
          {context.data?.cards.length === 0 && (
            <p>No personal on-budget credit cards or lines of credit.</p>
          )}
          {!editable && context.data && (
            <p>Use the current month while connected to change card funding.</p>
          )}
          {context.data?.cards.map((card) => (
            <div
              key={card.accountId}
              className="border border-border rounded-md p-3 grid min-w-0 gap-2"
            >
              <p className="font-semibold break-words">
                {card.name}
                {card.closed ? ' (closed)' : ''}
              </p>
              {card.funding ? (
                <>
                  <p>Debt: {formatCurrency(card.funding.debt)}</p>
                  <p>Cash reserved for payment: {formatCurrency(card.funding.reserved)}</p>
                  <p>Payment shortfall: {formatCurrency(card.funding.shortfall)}</p>
                  <p>Card credit, not cash: {formatCurrency(card.funding.creditBalance)}</p>
                  {card.funding.unlinkedInflows > 0 && (
                    <p>
                      Review {card.funding.unlinkedInflows} unlinked card inflows in the register.
                    </p>
                  )}
                  {card.funding.pendingTransfers > 0 && (
                    <p>
                      Payment legs have different posting dates; funding assessment is incomplete
                      until both arrive.
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    aria-label={`Adjust payment funding for ${card.name}`}
                    disabled={!editable || mutation.isPending}
                    onClick={() => {
                      setSelected(card.accountId);
                      setSetup(null);
                      setFunding(null);
                      setMessage('');
                    }}
                  >
                    Adjust payment funding
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  aria-label={`Review setup for ${card.name}`}
                  disabled={!editable || mutation.isPending}
                  onClick={() => {
                    setSelected(card.accountId);
                    mutation.mutate({ kind: 'setup-preview', id: card.accountId });
                  }}
                >
                  Review setup
                </Button>
              )}
            </div>
          ))}
          {setup && (
            <div role="region" aria-label="Card setup preview" className="grid gap-2">
              <p className="font-semibold">
                Enable {setup.name} from {setup.enabledFrom}
              </p>
              <p>Unassigned before: {formatCurrency(setup.beforeUnassigned)}</p>
              <p>Unassigned after: {formatCurrency(setup.afterUnassigned)}</p>
              <p>Existing debt: {formatCurrency(setup.debt)}</p>
              <p>Cash reserved after setup: {formatCurrency(setup.reserved)}</p>
              <p>Payment shortfall: {formatCurrency(setup.shortfall)}</p>
              <p>{setup.note}</p>
              <Button
                disabled={!editable || mutation.isPending}
                onClick={() => mutation.mutate({ kind: 'setup-apply', id: setup.accountId })}
              >
                Confirm card setup
              </Button>
            </div>
          )}
          {selected &&
            !setup &&
            context.data?.cards.find((c) => c.accountId === selected)?.funding && (
              <div className="grid gap-2">
                <label>
                  Amount from unassigned money
                  <input
                    aria-label="Payment funding amount"
                    inputMode="decimal"
                    className="block w-full bg-surface border border-border p-2"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setFunding(null);
                    }}
                  />
                </label>
                <p>
                  Use a negative amount to release payment cash. Cover category deficits by
                  assigning to their expense envelopes.
                </p>
                <Button
                  disabled={!editable || mutation.isPending}
                  onClick={() => mutation.mutate({ kind: 'funding-preview', id: selected })}
                >
                  Preview payment funding
                </Button>
              </div>
            )}
          {funding && (
            <div role="region" aria-label="Payment funding preview" className="grid gap-2">
              <p>Payment reserve after: {formatCurrency(funding.reservedAfter)}</p>
              <p>Payment shortfall after: {formatCurrency(funding.shortfallAfter)}</p>
              <p>Unassigned after: {formatCurrency(funding.unassignedAfter)}</p>
              <Button
                disabled={!editable || mutation.isPending}
                onClick={() => mutation.mutate({ kind: 'funding-apply', id: funding.accountId })}
              >
                Apply payment funding
              </Button>
            </div>
          )}
          {message && <p role="status">{message}</p>}
          <details>
            <summary>Payment funding history</summary>
            {context.data?.history.map((e) => (
              <p key={e.id}>
                {e.date}:{' '}
                {context.data?.cards.find((c) => c.accountId === e.accountId)?.name ?? 'Card'}{' '}
                {formatCurrency(e.amount)}
              </p>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}

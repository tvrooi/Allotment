import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useImportBatches, useImportConfirm, useUndoImport } from '../../hooks/useTransactions';
import { formatDay } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import type { UndoImportResult } from '../../api/transactions';

// "Undo this file" (SEC-01). The server removes the rows a file import added, except any the
// person has since worked on (reconciled, reviewed, transfers, hand splits, household shares,
// attached files), and says which it kept and why. What it removed comes back in the import's own
// shape, so "Put them back" is an ordinary import of the same rows.

interface Target {
  id: string;
  /** Shown to the person: the file's name, or what to call it without one */
  label: string;
  rows: number;
}

export interface Undone {
  label: string;
  result: UndoImportResult;
}

/** The button and its confirmation for one import; `onUndone` gets what the server did */
export function UndoImport({
  target,
  onUndone,
}: {
  target: Target;
  onUndone: (done: Undone) => void;
}) {
  const canSave = useCanSave();
  const undo = useUndoImport();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={undo.isPending || !canSave}
        onClick={() => setAsking(true)}
        aria-label={`Undo import ${target.label}`}
      >
        <Undo2 size={12} /> Undo this import
      </Button>
      {error && <p className="w-full text-xs text-negative">{error}</p>}
      <ConfirmModal
        isOpen={asking}
        onClose={() => setAsking(false)}
        title="Undo this import?"
        message={`This removes the ${target.rows} transaction${target.rows === 1 ? '' : 's'} added by ${target.label}. Anything you have reconciled, marked reviewed, linked as a transfer, split or shared is kept, and you can put the removed ones back right after.`}
        confirmLabel="Remove them"
        danger
        onConfirm={() => {
          setError(null);
          undo.mutate(target.id, {
            onSuccess: (result) => onUndone({ label: target.label, result }),
            onError: (e) => setError(e instanceof Error ? e.message : 'Could not undo the import'),
          });
        }}
      />
    </>
  );
}

/** What an undo did: what was removed, what was kept and why, and a way to put it back */
export function UndoOutcome({
  accountId,
  currency,
  done,
}: {
  accountId: string;
  currency: string | null;
  done: Undone;
}) {
  const canSave = useCanSave();
  const reimport = useImportConfirm();
  const [putBack, setPutBack] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { result, label } = done;
  const n = result.removed.length;
  return (
    <div className="text-xs text-text-secondary space-y-1" role="status">
      <p>
        {putBack !== null
          ? `Put ${putBack} transaction${putBack === 1 ? '' : 's'} back.`
          : `Removed ${n} transaction${n === 1 ? '' : 's'} from ${label}.`}
        {result.balanceRestored && putBack === null ? ' The starting balance was put back.' : ''}
      </p>
      {result.kept.length > 0 && (
        <div>
          <p className="text-caution">
            Kept {result.kept.length} you have worked on since. Delete them yourself if they are
            wrong:
          </p>
          <ul className="list-disc pl-4">
            {result.kept.slice(0, 5).map((k) => (
              <li key={k.id}>
                {formatDay(k.date)} · {k.payeeName || 'No payee'} ·{' '}
                {formatMoney(k.amount, currency)} — {k.reason}
              </li>
            ))}
          </ul>
          {result.kept.length > 5 && <p>and {result.kept.length - 5} more</p>}
        </div>
      )}
      {n > 0 && putBack === null && (
        <Button
          size="sm"
          variant="secondary"
          disabled={reimport.isPending || !canSave}
          onClick={() =>
            reimport.mutate(
              { accountId, rows: result.removed, fileName: label },
              {
                onSuccess: (r) => setPutBack(r.imported),
                onError: (e) =>
                  setError(e instanceof Error ? e.message : 'Could not put them back'),
              },
            )
          }
        >
          Put them back
        </Button>
      )}
      {error && <p className="text-negative">{error}</p>}
    </div>
  );
}

/** Undo with its outcome beside it, for a place that is not a list (the import's last step) */
export function UndoImportInline({
  accountId,
  currency,
  target,
}: {
  accountId: string;
  currency: string | null;
  target: Target;
}) {
  const [done, setDone] = useState<Undone | null>(null);
  if (done) return <UndoOutcome accountId={accountId} currency={currency} done={done} />;
  return <UndoImport target={target} onUndone={setDone} />;
}

/** The account's earlier file imports, each with Undo */
export function ImportHistory({
  accountId,
  currency,
}: {
  accountId: string;
  currency: string | null;
}) {
  const { data: batches = [] } = useImportBatches(accountId);
  // Kept here, not in the row: the row goes once the file's rows are gone
  const [undone, setUndone] = useState<(Undone & { key: number })[]>([]);
  if (!batches.length && !undone.length) return null;
  return (
    <section className="mt-5" aria-labelledby="import-history-title">
      <h3 id="import-history-title" className="text-sm font-semibold text-text">
        Earlier imports
      </h3>
      <p className="text-xs text-text-tertiary mt-0.5">
        Imported the wrong file? Undo it here. Rows you have worked on since are kept.
      </p>
      <SavingPausedHint className="mt-1" />
      <ul className="mt-2 divide-y divide-border-light border border-border-light rounded-lg">
        {batches.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text truncate">{b.fileName || 'Imported file'}</p>
              <p className="text-xs text-text-tertiary">
                {formatDay(b.createdAt.slice(0, 10))} · {b.remaining} of {b.rowCount} transaction
                {b.rowCount === 1 ? '' : 's'} in this account
              </p>
            </div>
            <UndoImport
              target={{ id: b.id, label: b.fileName || 'this file', rows: b.remaining }}
              onUndone={(done) => setUndone((u) => [{ ...done, key: Date.now() }, ...u])}
            />
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-2">
        {undone.map((d) => (
          <UndoOutcome key={d.key} accountId={accountId} currency={currency} done={d} />
        ))}
      </div>
    </section>
  );
}

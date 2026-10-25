import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import {
  receiptFileUrl,
  type AttachOutcome,
  type LineItem,
  type ReceiptDetail,
} from '../../api/tax';
import {
  useCreateTransactionFromReceipt,
  useDeleteReceipt,
  useReceipt,
  useReceiptSearch,
  useSplitByItems,
  useUpdateReceipt,
} from '../../hooks/useTax';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { CategorySelect } from '../transactions/CategorySelect';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';

/** What matching did to the transaction, in words */
export function outcomeText(o: AttachOutcome | null | undefined): string | null {
  if (!o) return null;
  const done = [
    o.split ? `split into ${o.split} categories` : null,
    o.categorised ? 'categorised' : null,
    o.notesAdded ? 'notes added' : null,
    o.tagged ? 'tagged Receipt' : null,
  ].filter(Boolean);
  const said = done.length ? `Matched: ${done.join(', ')}.` : 'Matched.';
  return o.skipped ? `${said} ${o.skipped}.` : said;
}

const HOW: Record<string, string> = {
  auto: 'matched automatically',
  manual: 'matched by you',
  created: 'made from this receipt',
};

/**
 * One receipt: what it says (merchant, date, amounts, line items with their categories) and
 * the transaction it belongs to. Like Monarch: match it to a transaction that's already there,
 * or add one when none will arrive from a bank. A receipt never changes an amount.
 */
export function ReceiptEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: receipt } = useReceipt(id);
  // Outside the form, so a newer copy of the receipt (after a save, or from another device)
  // replaces what is shown without losing what the last save said
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  return (
    <Modal isOpen={!!id} onClose={onClose} title="Receipt" size="xl">
      {receipt ? (
        <Editor
          key={`${receipt.id}:${receipt.updatedAt}`}
          receipt={receipt}
          onClose={onClose}
          message={message?.id === receipt.id ? message.text : null}
          setMessage={(text) => setMessage(text === null ? null : { id: receipt.id, text })}
        />
      ) : (
        <div className="h-40 bg-surface-alt rounded animate-pulse" />
      )}
    </Modal>
  );
}

function Editor({
  receipt,
  onClose,
  message,
  setMessage,
}: {
  receipt: ReceiptDetail;
  onClose: () => void;
  message: string | null;
  setMessage: (text: string | null) => void;
}) {
  const update = useUpdateReceipt();
  const remove = useDeleteReceipt();
  const { data: groups = [] } = useCategories();
  const [merchant, setMerchant] = useState(receipt.merchant ?? '');
  const [date, setDate] = useState(receipt.receiptDate ?? '');
  const [total, setTotal] = useState(receipt.total ?? 0);
  const [subtotal, setSubtotal] = useState(receipt.subtotal ?? 0);
  const [tax, setTax] = useState(receipt.tax ?? 0);
  const [tip, setTip] = useState(receipt.tip ?? 0);
  const [notes, setNotes] = useState(receipt.notes ?? '');
  const [items, setItems] = useState<LineItem[]>(
    receipt.lineItems.map(({ description, amount, categoryId }) => ({
      description,
      amount,
      categoryId,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const change = {
    merchant: merchant.trim() || null,
    receiptDate: date || null,
    total: total || null,
    subtotal: subtotal || null,
    tax: tax || null,
    tip: tip || null,
    notes: notes.trim() || null,
    lineItems: items.filter((i) => i.description.trim()),
  };

  async function save(extra: Parameters<typeof update.mutateAsync>[0]['change'] = {}) {
    setError(null);
    try {
      const out = await update.mutateAsync({ id: receipt.id, change: { ...change, ...extra } });
      setMessage(outcomeText(out.outcome) ?? 'Saved.');
      return out;
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const photo =
    receipt.hasFile && receipt.mimeType.startsWith('image/') && receipt.mimeType !== 'image/heic';

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-2">
        <a
          href={receipt.hasFile ? receiptFileUrl(receipt.id) : undefined}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md border border-border-light bg-surface-alt overflow-hidden"
        >
          {photo ? (
            <img
              src={receiptFileUrl(receipt.id)}
              alt={receipt.fileName}
              className="w-full max-h-[28rem] object-contain"
            />
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
              <FileText size={28} />
              {receipt.hasFile ? 'Open the file' : 'The file is not on this installation'}
            </div>
          )}
        </a>
        <p className="text-xs text-text-tertiary truncate">{receipt.fileName}</p>
      </div>

      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Merchant</span>
            <Input
              aria-label="Merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Date</span>
            <Input
              aria-label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Amount (total paid)</span>
            <CurrencyInput aria-label="Amount" value={total} onChange={setTotal} />
          </label>
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Subtotal</span>
            <CurrencyInput aria-label="Subtotal" value={subtotal} onChange={setSubtotal} />
          </label>
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Tax (GST)</span>
            <CurrencyInput aria-label="Tax" value={tax} onChange={setTax} />
          </label>
          <label className="text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Tip and fees</span>
            <CurrencyInput aria-label="Tip and fees" value={tip} onChange={setTip} />
          </label>
        </div>

        <section aria-label="Line items" className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-text-secondary">Line items</p>
            {items.length > 0 && (
              <p className="text-xs text-text-tertiary tabular-nums">
                Items {formatCurrency(itemsTotal)}
              </p>
            )}
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,2fr)_7rem_minmax(0,2fr)_auto] gap-2 items-center"
            >
              <Input
                aria-label={`Item ${i + 1}`}
                placeholder="Item"
                value={item.description}
                onChange={(e) =>
                  setItems(
                    items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                  )
                }
              />
              <CurrencyInput
                aria-label={`Item ${i + 1} amount`}
                value={item.amount}
                onChange={(amount) =>
                  setItems(items.map((x, j) => (j === i ? { ...x, amount } : x)))
                }
              />
              <div className="rounded-lg border border-border px-2 py-2">
                <CategorySelect
                  label={`Item ${i + 1} category`}
                  value={item.categoryId}
                  groups={groups}
                  onChange={(categoryId) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, categoryId } : x)))
                  }
                />
              </div>
              <button
                type="button"
                aria-label={`Remove item ${i + 1}`}
                className="p-1 rounded text-text-tertiary hover:text-negative"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setItems([...items, { description: '', amount: 0, categoryId: null }])}
          >
            <Plus size={13} /> Add item
          </Button>
          <p className="text-xs text-text-tertiary">
            Give items categories and, with autosplit on, a matched transaction with no category yet
            is split by them: tax in proportion, tip and fees evenly per item. Split by items does
            it for one that has a category.
          </p>
        </section>

        <label className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Notes</span>
          <Input
            aria-label="Receipt notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={update.isPending}>
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await remove.mutateAsync(receipt.id);
              onClose();
            }}
          >
            <Trash2 size={13} /> Delete receipt
          </Button>
        </div>
        <p className="text-xs text-text-tertiary">
          Deleting a receipt never deletes its transaction.
        </p>
        {message && (
          <p role="status" className="text-sm text-text-secondary">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <MatchSection receipt={receipt} onSave={save} onMessage={setMessage} />
      </div>
    </div>
  );
}

function MatchSection({
  receipt,
  onSave,
  onMessage,
}: {
  receipt: ReceiptDetail;
  onSave: (extra: { transactionId?: string | null }) => Promise<unknown>;
  onMessage: (m: string | null) => void;
}) {
  const [mode, setMode] = useState<'find' | 'add' | null>(null);
  const split = useSplitByItems();
  const [splitError, setSplitError] = useState<string | null>(null);
  const categories = new Set(receipt.lineItems.map((i) => i.categoryId).filter(Boolean));
  if (receipt.transactionId) {
    return (
      <section
        aria-label="Matched transaction"
        className="rounded-md border border-border-light p-3 space-y-2"
      >
        <p className="text-sm">
          <span className="font-medium text-positive">Matched</span>
          <span className="text-text-tertiary"> · {HOW[receipt.matchedBy ?? 'manual']}</span>
        </p>
        {receipt.transaction && (
          <p className="text-sm text-text-secondary">
            {formatDay(receipt.transaction.date)} · {receipt.transaction.payeeName ?? '—'} ·{' '}
            {receipt.transaction.accountName} ·{' '}
            <span className="tabular-nums">{formatCurrency(-receipt.transaction.amount)}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {categories.size >= 2 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={split.isPending}
              onClick={async () => {
                setSplitError(null);
                try {
                  const out = await split.mutateAsync(receipt.id);
                  onMessage(`Split into ${out.split} categories.`);
                } catch (e) {
                  setSplitError((e as Error).message);
                }
              }}
            >
              Split by items
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => onSave({ transactionId: null })}>
            Unmatch
          </Button>
        </div>
        {splitError && (
          <p role="alert" className="text-xs text-negative">
            {splitError}
          </p>
        )}
        <p className="text-xs text-text-tertiary">
          Unmatching keeps what was added to the transaction (its tag, notes or split).
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Match" className="rounded-md border border-border-light p-3 space-y-3">
      <p className="text-sm">
        <span className="font-medium text-caution">Unmatched</span>
        <span className="text-text-tertiary">
          {' '}
          · it is matched automatically when a transaction with its amount arrives
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={mode === 'find' ? 'primary' : 'secondary'}
          onClick={() => setMode('find')}
        >
          Find match
        </Button>
        <Button
          size="sm"
          variant={mode === 'add' ? 'primary' : 'secondary'}
          onClick={() => setMode('add')}
        >
          Add transaction
        </Button>
      </div>
      {mode === 'find' && (
        <FindMatch receipt={receipt} onPick={(id) => onSave({ transactionId: id })} />
      )}
      {mode === 'add' && (
        <AddFromReceipt receipt={receipt} onMessage={onMessage} onSaveFirst={() => onSave({})} />
      )}
    </section>
  );
}

function FindMatch({ receipt, onPick }: { receipt: ReceiptDetail; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data: matches = [], isFetching } = useReceiptSearch(receipt.id, query);
  return (
    <div className="space-y-2">
      <Input
        aria-label="Search transactions"
        placeholder="Search by payee or notes (60 days either side)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {matches.length === 0 && !isFetching && (
        <p className="text-xs text-text-tertiary">
          {query ? 'Nothing found.' : 'Nothing close by yet: search by name.'}
        </p>
      )}
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate">
              {formatDay(m.date)} · {m.payeeName ?? '—'} · {m.accountName}
              {m.exactAmount && <span className="ml-1 text-xs text-positive">same amount</span>}
            </span>
            <span className="tabular-nums">{formatCurrency(-m.amount)}</span>
            <Button size="sm" variant="secondary" onClick={() => onPick(m.id)}>
              Match
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddFromReceipt({
  receipt,
  onMessage,
  onSaveFirst,
}: {
  receipt: ReceiptDetail;
  onMessage: (m: string | null) => void;
  /** Saves what has been typed, so the transaction is made from it */
  onSaveFirst: () => Promise<unknown>;
}) {
  const { data: accounts = [] } = useAccounts();
  const open = accounts.filter((a) => !a.closedAt);
  const [accountId, setAccountId] = useState('');
  const create = useCreateTransactionFromReceipt();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        For a purchase that won't arrive from a bank (cash, or an account without bank sync), made
        from the merchant, date and amount above. If the bank will send it, find the match instead,
        or you'll have it twice.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          aria-label="Account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Choose an account…</option>
          {open.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          disabled={!accountId || create.isPending}
          onClick={async () => {
            setError(null);
            try {
              const saved = await onSaveFirst();
              if (!saved) return;
              const out = await create.mutateAsync({ id: receipt.id, body: { accountId } });
              onMessage(`Transaction added. ${outcomeText(out.outcome) ?? ''}`.trim());
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Create transaction
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

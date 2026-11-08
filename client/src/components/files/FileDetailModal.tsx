import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Link2, ReceiptText, ScanText, Star, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fileUrl, type FileLink, type LinkKind, type StoredDocument } from '../../api/files';
import { getTransactions } from '../../api/transactions';
import {
  useDeleteFile,
  useFile,
  useFindFileText,
  useLinkFile,
  useMakeReceipt,
  useUnlinkFile,
  useUpdateFile,
} from '../../hooks/useFiles';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useGoals } from '../../hooks/useGoals';
import { useCreateTag, useTags } from '../../hooks/useTags';
import { useDebounce } from '../../hooks/useDebounce';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useAssets } from '../../hooks/useAssets';
import { Private } from '../ui/Private';
import { FilePreview, formatBytes } from './FileParts';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const KIND_NOUNS: Record<LinkKind, string> = {
  transaction: 'Transaction',
  category: 'Category',
  goal: 'Goal',
  account: 'Account',
  asset: 'Asset',
  investmentSale: 'Sale',
  investmentIncome: 'Payment',
};
/** Linked from their own dialogs on Investments, not chosen here */
const PICKED_ELSEWHERE = new Set<LinkKind>(['investmentSale', 'investmentIncome']);

/** Where a link goes in the app */
function linkTarget(link: FileLink) {
  if (link.kind === 'category') return `/budget/category/${encodeURIComponent(link.id)}`;
  if (link.kind === 'account') return `/accounts/${encodeURIComponent(link.id)}`;
  if (link.kind === 'goal') return '/goals';
  if (link.kind === 'asset') return `/tax?tab=assets&asset=${encodeURIComponent(link.id)}`;
  if (link.kind === 'investmentSale' || link.kind === 'investmentIncome') return '/investments';
  return `/transactions?search=${encodeURIComponent(link.label)}`;
}

export function LinkLabel({ link }: { link: FileLink }) {
  if (link.kind !== 'transaction') return <>{link.label}</>;
  return (
    <>
      {link.label}
      <span className="text-text-tertiary">
        {link.date && ` · ${formatDay(link.date)}`}
        {link.amount !== undefined && (
          <>
            {' · '}
            <Private>{formatCurrency(link.amount)}</Private>
          </>
        )}
        {link.accountName && ` · ${link.accountName}`}
      </span>
    </>
  );
}

/** Choose something to link a file to: a transaction by search, or a category, goal or account */
function AddLink({ doc, onDone }: { doc: StoredDocument; onDone: () => void }) {
  const [kind, setKind] = useState<LinkKind>('transaction');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const link = useLinkFile();
  const { data: groups = [] } = useCategories();
  const { data: goals = [] } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const { data: assets = [] } = useAssets();
  const { data: found = [], isFetching } = useQuery({
    queryKey: ['files', 'link-search', q],
    queryFn: () => getTransactions({ search: q, limit: 20 }),
    enabled: kind === 'transaction' && q.length >= 2,
  });
  const linked = new Set(doc.links.map((l) => `${l.kind}:${l.id}`));
  const add = async (targetId: string) => {
    if (!targetId) return;
    await link.mutateAsync({ id: doc.id, kind, targetId });
    onDone();
  };
  return (
    <div className="space-y-2 rounded-md border border-border-light p-3">
      <div className="flex gap-1 flex-wrap" role="group" aria-label="Link to">
        {(Object.keys(KIND_NOUNS) as LinkKind[])
          // Assets appear once there are any, on Tax time
          .filter((k) => !PICKED_ELSEWHERE.has(k) && (k !== 'asset' || assets.length > 0))
          .map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? 'primary' : 'ghost'}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {KIND_NOUNS[k]}
            </Button>
          ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone} aria-label="Cancel">
          <X size={14} />
        </Button>
      </div>
      {kind === 'transaction' ? (
        <>
          <Input
            autoFocus
            placeholder="Search payees and notes"
            aria-label="Search transactions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {q.length >= 2 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border-light">
              {found.length === 0 && (
                <li className="py-2 text-xs text-text-tertiary">
                  {isFetching ? 'Searching…' : 'No transactions found.'}
                </li>
              )}
              {found.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={linked.has(`transaction:${t.id}`) || link.isPending}
                    onClick={() => add(t.id)}
                    className="w-full py-2 text-left text-sm hover:bg-hover disabled:opacity-50"
                  >
                    {t.payeeName || 'Transaction'}
                    <span className="text-text-tertiary">
                      {' · '}
                      {formatDay(t.date)}
                      {' · '}
                      <Private>{formatCurrency(t.amount)}</Private>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Select
          aria-label={`Choose a ${KIND_NOUNS[kind].toLowerCase()}`}
          defaultValue=""
          onChange={(e) => add(e.target.value)}
          disabled={link.isPending}
        >
          <option value="">Choose…</option>
          {kind === 'category' &&
            groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id} disabled={linked.has(`category:${c.id}`)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          {kind === 'goal' &&
            goals.map((g) => (
              <option key={g.id} value={g.id} disabled={linked.has(`goal:${g.id}`)}>
                {g.name}
              </option>
            ))}
          {kind === 'account' &&
            accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={linked.has(`account:${a.id}`)}>
                {a.name}
              </option>
            ))}
          {kind === 'asset' &&
            assets.map((a) => (
              <option key={a.id} value={a.id} disabled={linked.has(`asset:${a.id}`)}>
                {a.name}
              </option>
            ))}
        </Select>
      )}
      {link.error && (
        <p role="alert" className="text-xs text-negative">
          {(link.error as Error).message}
        </p>
      )}
    </div>
  );
}

/** Labels: the budget's tags, shared with transactions */
function Labels({ doc }: { doc: StoredDocument }) {
  const { data: tags = [] } = useTags();
  const update = useUpdateFile();
  const create = useCreateTag();
  const [name, setName] = useState('');
  const chosen = new Set(doc.tags.map((t) => t.id));
  const set = (ids: string[]) => update.mutate({ id: doc.id, change: { tagIds: ids } });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const on = chosen.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => set(on ? [...chosen].filter((x) => x !== t.id) : [...chosen, t.id])}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${on ? 'text-white border-transparent' : 'text-text-secondary border-border'}`}
              style={on ? { backgroundColor: t.color } : undefined}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
          const tag = existing ?? (await create.mutateAsync({ name: trimmed }));
          set([...chosen, tag.id]);
          setName('');
        }}
      >
        <Input
          placeholder="New label"
          aria-label="New label"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Button size="sm" variant="secondary" type="submit" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

function Details({ doc }: { doc: StoredDocument }) {
  const update = useUpdateFile();
  const [fileName, setFileName] = useState(doc.fileName);
  const [description, setDescription] = useState(doc.description ?? '');
  const [date, setDate] = useState(doc.documentDate ?? '');
  useEffect(() => {
    setFileName(doc.fileName);
    setDescription(doc.description ?? '');
    setDate(doc.documentDate ?? '');
  }, [doc.fileName, doc.description, doc.documentDate]);
  const save = (change: Parameters<typeof update.mutate>[0]['change']) =>
    update.mutate({ id: doc.id, change });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-text-secondary space-y-1">
        <span>Name</span>
        <Input
          value={fileName}
          maxLength={200}
          onChange={(e) => setFileName(e.target.value)}
          onBlur={() => fileName.trim() && fileName !== doc.fileName && save({ fileName })}
        />
      </label>
      <label className="text-xs text-text-secondary space-y-1">
        <span>Date</span>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            save({ documentDate: e.target.value || null });
          }}
        />
      </label>
      <label className="text-xs text-text-secondary space-y-1 sm:col-span-2">
        <span>Description</span>
        <textarea
          value={description}
          maxLength={2000}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (doc.description ?? '') && save({ description: description || null })
          }
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </label>
      {update.error && (
        <p role="alert" className="text-xs text-negative sm:col-span-2">
          {(update.error as Error).message}
        </p>
      )}
    </div>
  );
}

/**
 * One file: its preview, details, labels and everything it is linked to. Removing a link never
 * removes the file; Delete does, after asking.
 */
export function FileDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: doc, error } = useFile(id);
  const update = useUpdateFile();
  const unlink = useUnlinkFile();
  const remove = useDeleteFile();
  const makeReceipt = useMakeReceipt();
  const findText = useFindFileText();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setAdding(false), [id]);

  return (
    <Modal isOpen={!!id} onClose={onClose} title={doc?.fileName ?? 'File'} size="xl">
      {error && <p className="text-sm text-negative">{(error as Error).message}</p>}
      {doc && (
        <div className="space-y-5">
          <FilePreview doc={doc} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={doc.important ? 'primary' : 'secondary'}
              aria-pressed={doc.important}
              onClick={() => update.mutate({ id: doc.id, change: { important: !doc.important } })}
            >
              Important
            </Button>
            <Button
              size="sm"
              variant={doc.starred ? 'primary' : 'secondary'}
              aria-pressed={doc.starred}
              onClick={() => update.mutate({ id: doc.id, change: { starred: !doc.starred } })}
            >
              <Star size={13} /> {doc.starred ? 'Starred' : 'Star'}
            </Button>
            {doc.hasFile && (
              <a
                href={fileUrl(doc.id, true)}
                download={doc.fileName}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-alt"
              >
                <Download size={13} /> Download
              </a>
            )}
            <span className="ml-auto text-xs text-text-tertiary">
              {formatBytes(doc.size)} · added {formatDay(doc.createdAt.slice(0, 10))}
            </span>
          </div>

          <Details doc={doc} />

          <section aria-label="Labels" className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">Labels</p>
            <Labels doc={doc} />
          </section>

          <section aria-label="Linked to" className="space-y-2">
            <div className="flex items-center">
              <p className="text-xs font-medium text-text-secondary">Linked to</p>
              {!adding && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setAdding(true)}
                >
                  <Link2 size={13} /> Link
                </Button>
              )}
            </div>
            {doc.links.length === 0 && !adding && (
              <p className="text-xs text-text-tertiary">
                Not linked to anything yet. Link it to transactions, categories, goals, accounts or
                assets.
              </p>
            )}
            <ul className="space-y-1.5">
              {doc.links.map((l) => (
                <li key={`${l.kind}:${l.id}`} className="flex items-center gap-2 text-sm">
                  <span className="text-2xs uppercase tracking-wide text-text-tertiary w-24 shrink-0">
                    {l.viaReceipt ? 'Receipt for' : KIND_NOUNS[l.kind]}
                  </span>
                  <Link
                    to={linkTarget(l)}
                    onClick={onClose}
                    className="flex-1 min-w-0 truncate hover:text-brand-600"
                  >
                    <LinkLabel link={l} />
                  </Link>
                  <button
                    type="button"
                    className="p-1 rounded text-text-tertiary hover:text-negative"
                    aria-label={`Remove the link to ${l.label}`}
                    title={
                      l.viaReceipt ? 'Unmatch the receipt' : 'Remove the link (the file stays)'
                    }
                    onClick={() => unlink.mutate({ id: doc.id, kind: l.kind, targetId: l.id })}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {adding && <AddLink doc={doc} onDone={() => setAdding(false)} />}
          </section>

          <div className="flex flex-wrap items-center gap-2 border-t border-border-light pt-4">
            {doc.receipt ? (
              <Link
                to={`/transactions?view=receipts&receipt=${encodeURIComponent(doc.receipt.id)}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <ReceiptText size={14} /> Open the receipt
              </Link>
            ) : (
              RECEIPT_TYPES.includes(doc.mimeType) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={makeReceipt.isPending}
                  onClick={() => makeReceipt.mutate(doc.id)}
                  title="Receipts reads, matches and splits it"
                >
                  <ReceiptText size={13} /> Use as a receipt
                </Button>
              )
            )}
            {doc.kind === 'image' && doc.mimeType !== 'image/heic' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={findText.isPending || doc.textStatus === 'pending'}
                onClick={() => findText.mutate(doc.id)}
                title="With reading receipts turned on, your local model reads the photo's words for search"
              >
                <ScanText size={13} />
                {doc.textStatus === 'pending' ? 'Reading…' : 'Read its text'}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-negative"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={13} /> Delete
            </Button>
          </div>
          {(makeReceipt.error || findText.error || unlink.error) && (
            <p role="alert" className="text-xs text-negative">
              {((makeReceipt.error || findText.error || unlink.error) as Error).message}
            </p>
          )}
          {doc.textStatus === 'none' && doc.kind === 'image' && (
            <p className="text-xs text-text-tertiary">
              No text was read. Turn on reading receipts (Transactions → Receipts → Settings) to
              search photos by their words.
            </p>
          )}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!doc) return;
          await remove.mutateAsync(doc.id);
          setConfirmDelete(false);
          onClose();
        }}
        title="Delete this file?"
        message={
          doc?.receipt
            ? 'It is a receipt too: the receipt is deleted with it. Its links go, and the transactions stay as they are.'
            : 'Its links go with it; what it was linked to stays as it is.'
        }
        confirmLabel="Delete"
        danger
      />
    </Modal>
  );
}

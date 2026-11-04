import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Settings } from 'lucide-react';
import type { Receipt } from '../../api/tax';
import {
  useMatchReceiptsNow,
  useReaderModels,
  useReaderSettings,
  useReceiptSettings,
  useSampleRead,
  useStartSampleRead,
  useReceipts,
  useSetReaderSettings,
  useSetReceiptSettings,
  useUploadReceipt,
} from '../../hooks/useTax';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { ReceiptDrop, ReceiptThumb, receiptFiles } from '../tax/ReceiptsSection';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ReceiptEditor } from './ReceiptEditor';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'matched', label: 'Matched' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

/** Upload one or more receipts, then open the first so its details can be typed */
export function useAddReceipts(onAdded?: (first: Receipt) => void) {
  const upload = useUploadReceipt();
  const [error, setError] = useState<string | null>(null);
  async function add(files: File[]) {
    setError(null);
    let first: Receipt | null = null;
    for (const file of files) {
      try {
        const r = await upload.mutateAsync({ file });
        first ??= r;
      } catch (e) {
        setError((e as Error).message);
      }
    }
    if (first) onAdded?.(first);
  }
  return { add, busy: upload.isPending, error };
}

/** "Scan receipt": on a phone the picker opens the camera */
export function ScanReceiptButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
        <Camera size={13} /> Scan receipt
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Scan receipt: take a photo"
        onChange={(e) => {
          onFiles(receiptFiles(e.target.files));
          e.target.value = '';
        }}
      />
    </>
  );
}

/**
 * The Receipts tab on Transactions, after Monarch's: every receipt, matched or not. Receipts are
 * matched automatically by amount, date and merchant as transactions arrive; open one to type
 * its details, find its match, or add a transaction for it.
 */
export function ReceiptsTab({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: receipts = [], isLoading } = useReceipts(
    filter === 'all' ? {} : { status: filter },
  );
  const { add, busy, error } = useAddReceipts((r) => onOpen(r.id));
  const matchNow = useMatchReceiptsNow();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 max-md:px-4">
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Show receipts">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? 'primary' : 'ghost'}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <ScanReceiptButton onFiles={add} />
            <Button
              size="sm"
              variant="secondary"
              disabled={matchNow.isPending}
              onClick={async () => {
                const { matched } = await matchNow.mutateAsync();
                setNote(
                  matched
                    ? `${matched} receipt${matched === 1 ? '' : 's'} matched.`
                    : 'No new matches.',
                );
              }}
            >
              <RefreshCw size={13} /> Match now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Receipt settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={14} />
            </Button>
          </div>
        </div>
        <ReceiptDrop onFiles={add} busy={busy} label="Upload receipts" />
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        {note && (
          <p role="status" className="text-sm text-text-secondary">
            {note}
          </p>
        )}

        {isLoading ? (
          <div className="h-24 bg-surface-alt rounded animate-pulse" />
        ) : receipts.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            {filter === 'all'
              ? 'No receipts yet. Upload or scan one: type its merchant, date and amount, and it is matched to its transaction.'
              : `No ${filter} receipts.`}
          </p>
        ) : (
          <ul className="divide-y divide-border-light rounded-md border border-border-light">
            {receipts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-label={`Receipt ${r.merchant ?? r.fileName}`}
                  onClick={() => onOpen(r.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover"
                >
                  <ReceiptThumb receipt={r} size={44} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text truncate">
                      {r.merchant ?? r.fileName}
                    </span>
                    <span className="block text-xs text-text-tertiary truncate">
                      {r.receiptDate ? formatDay(r.receiptDate) : 'No date yet'}
                      {r.transaction &&
                        ` · ${r.transaction.payeeName ?? '—'}, ${formatDay(r.transaction.date)}, ${r.transaction.accountName}`}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {r.total !== null ? formatCurrency(r.total) : '—'}
                  </span>
                  <span
                    className={`text-xs font-medium w-20 text-right ${r.transactionId ? 'text-positive' : r.readStatus === 'pending' ? 'text-text-secondary' : 'text-caution'}`}
                  >
                    {r.transactionId
                      ? 'Matched'
                      : r.readStatus === 'pending'
                        ? 'Reading…'
                        : 'Unmatched'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-tertiary">
          A receipt is matched to money out of exactly its amount: from the same merchant up to 2
          days before or 7 days after its date, or any merchant within a day. When two could fit,
          you choose. Receipts are kept in your budget's database, never sent anywhere.
        </p>
      </div>
      <ReceiptEditor id={openId} onClose={() => onOpen(null)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data } = useReceiptSettings();
  const set = useSetReceiptSettings();
  // Ticks at once; the saved settings follow
  const [s, setS] = useState(data);
  useEffect(() => setS(data), [data]);
  const toggle = (key: 'autoSplit' | 'addNotes' | 'addTag', label: string, hint: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={!!s?.[key]}
        onChange={(e) => {
          if (s) setS({ ...s, [key]: e.target.checked });
          set.mutate({ [key]: e.target.checked });
        }}
      />
      <span>
        {label}
        <span className="block text-xs text-text-tertiary">{hint}</span>
      </span>
    </label>
  );
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receipt settings">
      <div className="space-y-4">
        {toggle(
          'autoSplit',
          'Autosplit by category',
          "When a receipt's items have two or more categories, split a matched transaction that has no category or tax claim yet. Otherwise use Split by items on the receipt.",
        )}
        {toggle(
          'addNotes',
          'Add notes',
          "Add the receipt's notes and items to the transaction's notes.",
        )}
        {toggle('addTag', 'Tag "Receipt"', 'Tag each matched transaction "Receipt".')}
        <p className="text-xs text-text-tertiary">
          A receipt never changes a transaction's amount, and never changes a category you chose.
        </p>
        <ReaderSettingsSection />
      </div>
    </Modal>
  );
}

const CLOUD: Record<'anthropic' | 'openai', { name: string; model: string; keys: string }> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    model: 'claude-haiku-5-5',
    keys: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    model: 'gpt-5-mini',
    keys: 'https://platform.openai.com/api-keys',
  },
};

/**
 * Reading receipts with a model the owner chooses: a model server on their own network, or
 * Anthropic or OpenAI with their own API key. The photo goes only to that provider. Off until
 * the provider has what it needs.
 */
function ReaderSettingsSection() {
  const { data } = useReaderSettings();
  const save = useSetReaderSettings();
  const models = useReaderModels();
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Ticks at once; the saved setting follows (or it goes back, with the reason)
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!data) return;
    setUrl(data.url ?? '');
    setModel(data.model ?? '');
    setOn(data.enabled);
  }, [data]);
  const provider = data?.provider ?? 'local';
  const cloud = provider === 'local' ? null : CLOUD[provider];
  const ready = !!data?.model && (provider === 'local' ? !!data.url : data.hasKey);
  const found = models.data?.models ?? [];
  const choices = [...found].sort((a, b) => Number(b.vision === true) - Number(a.vision === true));
  async function apply(change: Parameters<typeof save.mutateAsync>[0]) {
    setError(null);
    try {
      await save.mutateAsync(change);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section
      aria-label="Read receipts automatically"
      className="border-t border-border-light pt-4 space-y-3"
    >
      <div>
        <p className="text-sm font-medium">Read receipts automatically</p>
        <p className="text-xs text-text-tertiary">
          A vision model fills in a photo's merchant, date, amounts and items, then the receipt is
          matched as usual. Fields you typed are never replaced. Photos only, not PDFs.
        </p>
      </div>
      <div className="block text-xs font-medium text-text-secondary space-y-1">
        <span className="block">Who reads them</span>
        <Select
          aria-label="Who reads them"
          value={provider}
          onChange={(e) => {
            const next = e.target.value as typeof provider;
            setOn(false);
            void apply({
              provider: next,
              enabled: false,
              model: next === 'local' ? null : CLOUD[next].model,
            });
          }}
        >
          <option value="local">A model server on your own network</option>
          <option value="anthropic">{CLOUD.anthropic.name}</option>
          <option value="openai">{CLOUD.openai.name}</option>
        </Select>
      </div>
      {cloud ? (
        <>
          <p className="text-xs text-caution">
            Each photo is sent to {cloud.name.split(' ')[0]} and billed to your API key (usually a
            fraction of a cent). A Claude or ChatGPT subscription doesn't include API use; create a
            key at{' '}
            <a className="underline" href={cloud.keys} target="_blank" rel="noreferrer">
              {new URL(cloud.keys).host}
            </a>
            .
          </p>
          <label className="block text-xs font-medium text-text-secondary space-y-1">
            <span className="block">
              API key {data?.hasKey && '(saved; type a new one to replace it)'}
            </span>
            <div className="flex gap-2">
              <Input
                aria-label="API key"
                type="password"
                autoComplete="off"
                placeholder={data?.hasKey ? '••••••••' : 'Paste your API key'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!key.trim() || save.isPending}
                onClick={async () => {
                  await apply({ apiKey: key.trim() });
                  setKey('');
                }}
              >
                Save
              </Button>
              {data?.hasKey && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOn(false);
                    void apply({ apiKey: null, enabled: false });
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </label>
          <div className="block text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Model</span>
            <Input
              aria-label="Model"
              placeholder={cloud.model}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() =>
                model.trim() !== (data?.model ?? '') && void apply({ model: model.trim() || null })
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="block text-xs font-medium text-text-secondary space-y-1">
            <span className="block">Server address (Ollama API)</span>
            <div className="flex gap-2">
              <Input
                aria-label="Server address"
                placeholder="http://model-server:11434"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!url.trim() || models.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    const out = await models.mutateAsync(url);
                    setUrl(out.url);
                    await save.mutateAsync({ url: out.url });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {models.isPending ? 'Checking…' : 'Check'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">The photo goes only to this address.</p>
          {found.length > 0 && (
            <label className="block text-xs font-medium text-text-secondary space-y-1">
              <span className="block">Model</span>
              <Select
                aria-label="Model"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  void apply({ model: e.target.value || null });
                }}
              >
                <option value="">Choose a model…</option>
                {choices.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {m.vision === true
                      ? ' (reads images)'
                      : m.vision === false
                        ? ' (text only)'
                        : ''}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {models.isSuccess && !found.some((m) => m.vision) && (
            <p className="text-xs text-caution">
              No model on this server can read images. Add a vision model to it first.
            </p>
          )}
          {data?.model && !found.length && (
            <p className="text-xs text-text-tertiary">Model: {data.model}</p>
          )}
        </>
      )}
      {ready && <SampleCheck onError={setError} />}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={on}
          disabled={!on && !ready}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setOn(enabled);
            setError(null);
            try {
              await save.mutateAsync({ enabled });
            } catch (err) {
              setOn(!enabled);
              setError((err as Error).message);
            }
          }}
        />
        <span>
          Read new photos when they are added
          <span className="block text-xs text-text-tertiary">
            One at a time in the background; on a small server each can take a minute or two.
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </section>
  );
}

/** Try the chosen model on a made-up receipt, to see how well and how fast it reads */
function SampleCheck({ onError }: { onError: (e: string | null) => void }) {
  const { data: sample } = useSampleRead();
  const start = useStartSampleRead();
  const running = sample?.status === 'running';
  const tick = (ok: boolean) => (ok ? '✓' : '✗');
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={running || start.isPending}
        onClick={async () => {
          onError(null);
          try {
            await start.mutateAsync();
          } catch (e) {
            onError((e as Error).message);
          }
        }}
      >
        {running ? 'Reading the sample…' : 'Try a sample receipt'}
      </Button>
      <p role="status" className="text-xs text-text-tertiary">
        {running
          ? `${sample.model} is reading a made-up receipt. On a small server this can take a few minutes.`
          : sample?.status === 'done'
            ? `${sample.model} took ${sample.seconds} s: merchant ${tick(sample.correct.merchant)}, date ${tick(sample.correct.date)}, total ${tick(sample.correct.total)}, GST ${tick(sample.correct.tax)}, items ${sample.correct.items} of ${sample.expected.items.length}.`
            : sample?.status === 'failed'
              ? `${sample.model} failed after ${sample.seconds} s: ${sample.error}`
              : 'Reads a made-up receipt; nothing in your budget changes.'}
      </p>
    </div>
  );
}

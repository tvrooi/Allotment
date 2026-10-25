import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { receiptFileUrl, type Receipt } from '../../api/tax';
import { useDeleteReceipt, useReceipts, useUploadReceipt } from '../../hooks/useTax';

/** A receipt's preview: the photo itself, or a document icon for a PDF or HEIC */
export function ReceiptThumb({ receipt, size = 56 }: { receipt: Receipt; size?: number }) {
  const shows =
    receipt.hasFile && receipt.mimeType.startsWith('image/') && receipt.mimeType !== 'image/heic';
  return (
    <a
      href={receipt.hasFile ? receiptFileUrl(receipt.id) : undefined}
      target="_blank"
      rel="noreferrer"
      title={receipt.hasFile ? `Open ${receipt.fileName}` : 'The file is not on this installation'}
      className="shrink-0 rounded-md border border-border-light bg-surface-alt overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {shows ? (
        <img
          src={receiptFileUrl(receipt.id)}
          alt={receipt.fileName}
          className="w-full h-full object-cover"
        />
      ) : (
        <FileText size={20} className="text-text-tertiary" aria-label={receipt.fileName} />
      )}
    </a>
  );
}

/** Files from a drop, a paste or the picker, receipts only */
export const receiptFiles = (list: FileList | null | undefined) =>
  [...(list ?? [])].filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');

/** Upload by choosing, dropping or pasting files; on a phone the picker offers the camera */
export function ReceiptDrop({
  onFiles,
  busy,
  label = 'Add a receipt',
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: File[]) => files.length && onFiles(files);
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={label}
      onPaste={(e: ClipboardEvent) => take(receiptFiles(e.clipboardData?.files))}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        take(receiptFiles(e.dataTransfer?.files));
      }}
      className={`rounded-lg border border-dashed px-3 py-2.5 text-xs text-text-tertiary flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-brand-600 ${over ? 'border-brand-600 bg-brand-50' : 'border-border'}`}
    >
      <Paperclip size={14} className="shrink-0" />
      <span className="flex-1">
        {busy ? 'Uploading…' : 'Drop, paste or '}
        {!busy && (
          <button
            type="button"
            className="font-medium text-brand-600 hover:text-brand-700"
            onClick={() => input.current?.click()}
          >
            choose a photo or PDF
          </button>
        )}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        aria-label={`${label}: choose files`}
        onChange={(e) => {
          take(receiptFiles(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** A transaction's receipts in its details panel */
export function ReceiptsSection({ transactionId }: { transactionId: string }) {
  const { data: receipts = [] } = useReceipts({ transactionId });
  const upload = useUploadReceipt();
  const remove = useDeleteReceipt();
  const [error, setError] = useState<string | null>(null);
  async function add(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, transactionId });
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  return (
    <section aria-label="Receipts" className="space-y-2">
      <p className="text-xs font-medium text-text-secondary">Receipts</p>
      {receipts.length > 0 && (
        <ul className="space-y-2">
          {receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <ReceiptThumb receipt={r} size={44} />
              <Link
                to={`/transactions?view=receipts&receipt=${encodeURIComponent(r.id)}`}
                className="flex-1 min-w-0 text-sm text-text truncate hover:text-brand-600"
                title="Open the receipt's details"
              >
                {r.merchant ?? r.fileName}
              </Link>
              {!r.hasFile && <span className="text-xs text-caution">File not here</span>}
              <button
                type="button"
                onClick={() => remove.mutate(r.id)}
                className="p-1 rounded text-text-tertiary hover:text-negative"
                aria-label={`Remove receipt ${r.fileName}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ReceiptDrop onFiles={add} busy={upload.isPending} />
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </section>
  );
}

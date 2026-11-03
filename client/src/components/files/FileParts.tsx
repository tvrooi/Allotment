import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import {
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Paperclip,
  Presentation,
} from 'lucide-react';
import { fileUrl, type FileKind, type StoredDocument } from '../../api/files';
import { PdfPreview } from './PdfPreview';

/** What the Files library accepts (the server checks each file's bytes) */
export const FILE_ACCEPT =
  'image/*,application/pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.csv,.md,.markdown,.txt,video/mp4,video/quicktime,.mov,.mp4';

export const KIND_LABELS: Record<FileKind, string> = {
  image: 'Photos',
  pdf: 'PDFs',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  text: 'Text',
  video: 'Videos',
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function KindIcon({ kind, size }: { kind: FileKind | null; size: number }) {
  const props = { size, className: 'text-text-tertiary' };
  if (kind === 'image') return <FileImage {...props} />;
  if (kind === 'spreadsheet') return <FileSpreadsheet {...props} />;
  if (kind === 'presentation') return <Presentation {...props} />;
  if (kind === 'video') return <FileVideo {...props} />;
  if (kind === 'pdf' || kind === 'document' || kind === 'text') return <FileText {...props} />;
  return <FileIcon {...props} />;
}

const drawable = (doc: StoredDocument) =>
  doc.hasFile && doc.kind === 'image' && doc.mimeType !== 'image/heic';

/** A file's preview tile: the photo itself, or an icon for its kind */
export function FileThumb({ doc, size = 48 }: { doc: StoredDocument; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-md border border-border-light bg-surface-alt overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {drawable(doc) ? (
        <img src={fileUrl(doc.id)} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <KindIcon kind={doc.kind} size={Math.round(size * 0.42)} />
      )}
    </span>
  );
}

/** Text and CSV files, shown as plain text (never rendered as HTML or Markdown) */
function TextPreview({ id }: { id: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(fileUrl(id), { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error())))
      .then((t) => !cancelled && setText(t.slice(0, 200_000)))
      .catch(() => !cancelled && setText(''));
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (text === null) return <div className="h-40 bg-surface-alt rounded animate-pulse" />;
  return (
    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded border border-border-light bg-surface-alt p-3 text-xs text-text">
      {text || 'Nothing to show.'}
    </pre>
  );
}

/** The file itself, as far as it can be shown in the page */
export function FilePreview({ doc }: { doc: StoredDocument }) {
  if (!doc.hasFile)
    return (
      <p className="text-sm text-caution">
        The file is not on this installation (backups carry files' details, not the files).
      </p>
    );
  if (drawable(doc))
    return (
      <img
        src={fileUrl(doc.id)}
        alt={doc.fileName}
        className="max-h-[60vh] mx-auto rounded border border-border-light"
      />
    );
  if (doc.kind === 'video')
    return (
      <video
        src={fileUrl(doc.id)}
        controls
        preload="metadata"
        className="max-h-[60vh] w-full rounded border border-border-light bg-black"
        aria-label={doc.fileName}
      />
    );
  if (doc.kind === 'pdf') return <PdfPreview id={doc.id} fileName={doc.fileName} />;
  if (doc.kind === 'text' || doc.mimeType === 'text/csv') return <TextPreview id={doc.id} />;
  return (
    <div className="flex items-center gap-3 rounded border border-border-light bg-surface-alt p-4">
      <KindIcon kind={doc.kind} size={28} />
      <p className="text-sm text-text-secondary">
        {doc.mimeType === 'image/heic'
          ? 'HEIC photos open in your photo app.'
          : 'Download it to open it in its app.'}
      </p>
    </div>
  );
}

/** Add files by choosing, dropping or pasting them */
export function FileDrop({
  onFiles,
  busy,
  label = 'Add files',
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  label?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null | undefined) => {
    const files = [...(list ?? [])];
    if (files.length) onFiles(files);
  };
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={label}
      onPaste={(e: ClipboardEvent) => take(e.clipboardData?.files)}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer?.files);
      }}
      className={`rounded-lg border border-dashed ${compact ? 'px-3 py-2' : 'px-4 py-5'} text-xs text-text-tertiary flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-brand-600 ${over ? 'border-brand-600 bg-brand-50' : 'border-border'}`}
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
            choose files
          </button>
        )}
        {!busy && !compact && (
          <span className="block mt-0.5">
            Photos, PDFs, Word, Excel, PowerPoint, OpenDocument, CSV, Markdown, text and videos
          </span>
        )}
      </span>
      <input
        ref={input}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        hidden
        aria-label={`${label}: choose files`}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

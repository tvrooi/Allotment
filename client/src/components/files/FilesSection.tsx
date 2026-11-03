import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Search, X } from 'lucide-react';
import { listFiles, type LinkKind } from '../../api/files';
import { useFiles, useLinkFile, useUnlinkFile, useUploadFile } from '../../hooks/useFiles';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDay } from '../../utils/dates';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FileDetailModal } from './FileDetailModal';
import { FileDrop, FileThumb } from './FileParts';

/** Pick a file already in the library to link here */
function AttachExisting({
  kind,
  targetId,
  linkedIds,
  onDone,
}: {
  kind: LinkKind;
  targetId: string;
  linkedIds: Set<string>;
  onDone: () => void;
}) {
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const link = useLinkFile();
  const { data } = useQuery({
    queryKey: ['files', 'attach', q],
    queryFn: () => listFiles({ q: q || undefined, limit: 20 }),
  });
  return (
    <div className="space-y-2 rounded-md border border-border-light p-2">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-text-tertiary shrink-0" />
        <Input
          autoFocus
          placeholder="Find a file by name, label or what it says"
          aria-label="Find a file to link"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={onDone}
          aria-label="Cancel"
          className="p-1 text-text-tertiary hover:text-text"
        >
          <X size={14} />
        </button>
      </div>
      <ul className="max-h-56 overflow-y-auto divide-y divide-border-light">
        {data?.documents.length === 0 && (
          <li className="py-2 text-xs text-text-tertiary">No files found.</li>
        )}
        {data?.documents.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={linkedIds.has(d.id) || link.isPending}
              onClick={async () => {
                await link.mutateAsync({ id: d.id, kind, targetId });
                onDone();
              }}
              className="w-full flex items-center gap-2 py-1.5 text-left text-sm hover:bg-hover disabled:opacity-50"
            >
              <FileThumb doc={d} size={28} />
              <span className="flex-1 min-w-0 truncate">{d.fileName}</span>
              <span className="text-xs text-text-tertiary">{formatDay(d.date)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The files linked to a transaction, category, goal or account: add new ones, link ones already
 * in Files, open or unlink them. Unlinking never deletes a file.
 */
export function FilesSection({
  kind,
  targetId,
  title = 'Files',
  hideReceipts = false,
}: {
  kind: LinkKind;
  targetId: string;
  title?: string;
  /** Leave out receipts matched here (a transaction shows those in its Receipts section) */
  hideReceipts?: boolean;
}) {
  const { data } = useFiles({ linkKind: kind, linkId: targetId, limit: 100 });
  const upload = useUploadFile();
  const unlink = useUnlinkFile();
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const docs = (data?.documents ?? []).filter(
    (d) =>
      !hideReceipts || !d.links.some((l) => l.kind === kind && l.id === targetId && l.viaReceipt),
  );

  async function add(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, link: { kind, id: targetId } });
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
  }

  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-center">
        <p className="text-xs font-medium text-text-secondary">{title}</p>
        {!attaching && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAttaching(true)}>
            <Link2 size={13} /> Link a file
          </Button>
        )}
      </div>
      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((d) => {
            const viaReceipt = d.links.some(
              (l) => l.kind === kind && l.id === targetId && l.viaReceipt,
            );
            return (
              <li key={d.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(d.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left hover:text-brand-600"
                  aria-label={`Open ${d.fileName}`}
                >
                  <FileThumb doc={d} size={36} />
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{d.fileName}</span>
                    <span className="block text-xs text-text-tertiary truncate">
                      {viaReceipt ? 'Receipt · ' : ''}
                      {formatDay(d.date)}
                      {d.tags.length > 0 && ` · ${d.tags.map((t) => t.name).join(', ')}`}
                    </span>
                  </span>
                </button>
                {!d.hasFile && <span className="text-xs text-caution">File not here</span>}
                <button
                  type="button"
                  onClick={() => unlink.mutate({ id: d.id, kind, targetId })}
                  className="p-1 rounded text-text-tertiary hover:text-negative"
                  aria-label={`Unlink ${d.fileName}`}
                  title={viaReceipt ? 'Unmatch the receipt' : 'Unlink (the file stays in Files)'}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {attaching && (
        <AttachExisting
          kind={kind}
          targetId={targetId}
          linkedIds={new Set(docs.map((d) => d.id))}
          onDone={() => setAttaching(false)}
        />
      )}
      <FileDrop onFiles={add} busy={upload.isPending} label={`Add files to ${title}`} compact />
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
      <FileDetailModal id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}

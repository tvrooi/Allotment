import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FolderOpen, Search, Star, Tag as TagIcon } from 'lucide-react';
import { filesExportUrl, type FileFilter, type FileKind } from '../api/files';
import { FileDetailModal } from '../components/files/FileDetailModal';
import { FileDrop, FileThumb, formatBytes, KIND_LABELS } from '../components/files/FileParts';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import {
  useFilePages,
  useFileStorage,
  useSetFileStorageCap,
  useUploadFile,
} from '../hooks/useFiles';
import { useDebounce } from '../hooks/useDebounce';
import { useTags } from '../hooks/useTags';
import { formatDay } from '../utils/dates';
import { QueryProblem, loadFailed } from '../components/ui/QueryProblem';

const VIEWS = [
  { id: '', label: 'All files' },
  { id: 'starred', label: 'Starred' },
  { id: 'important', label: 'Important' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'unlinked', label: 'Not linked' },
] as const;
type View = (typeof VIEWS)[number]['id'];
const PAGE = 60;

function StorageCard() {
  const { data } = useFileStorage();
  const setCap = useSetFileStorageCap();
  const [open, setOpen] = useState(false);
  const [cap, setCapText] = useState('');
  if (!data) return null;
  const capBytes = data.capMb ? data.capMb * 1024 * 1024 : null;
  const share = capBytes ? Math.min(1, data.bytes / capBytes) : null;
  return (
    <div className="rounded-md border border-border-light p-3 space-y-2 text-xs text-text-secondary">
      <p className="font-medium text-text">Storage</p>
      <p>
        {formatBytes(data.bytes)}
        {capBytes ? ` of ${formatBytes(capBytes)}` : ''} · {data.documents}{' '}
        {data.documents === 1 ? 'file' : 'files'}
      </p>
      {share !== null && (
        <div
          className="h-1.5 rounded-full bg-surface-alt overflow-hidden"
          role="meter"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className={`h-full ${share > 0.9 ? 'bg-negative' : 'bg-brand-600'}`}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <button
        type="button"
        className="font-medium text-brand-600 hover:text-brand-700"
        onClick={() => {
          setCapText(data.capMb ? String(data.capMb) : '');
          setOpen(true);
        }}
      >
        {data.capMb ? 'Change the limit' : 'Set a limit'}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Storage limit" size="sm">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const mb = cap.trim() ? Math.round(Number(cap)) : null;
            if (mb !== null && (!Number.isFinite(mb) || mb < 1)) return;
            await setCap.mutateAsync(mb);
            setOpen(false);
          }}
        >
          <p className="text-sm text-text-secondary">
            Files are kept with your budget on this server: the database holds them, and videos sit
            in a folder beside it. A limit stops new files once they would take more than this.
            Leave it empty for no limit.
          </p>
          <label className="block text-xs text-text-secondary space-y-1">
            <span>Limit in MB</span>
            <Input
              inputMode="numeric"
              value={cap}
              onChange={(e) => setCapText(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="No limit"
            />
          </label>
          <p className="text-xs text-text-tertiary">
            Each file can be up to {formatBytes(data.maxFileBytes)}, and a video up to{' '}
            {formatBytes(data.maxVideoBytes)}.
          </p>
          {setCap.error && (
            <p role="alert" className="text-xs text-negative">
              {(setCap.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={setCap.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Files: every document kept with the budget (bills, warranties, policies, receipts), each linked
 * to any number of transactions, categories, goals and accounts. URL state: q, view, tag, kind,
 * from, to, and file (the one open).
 */
export default function FilesPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') ?? '') as View;
  const tag = params.get('tag') ?? '';
  const kind = (params.get('kind') ?? '') as FileKind | '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const openId = params.get('file');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounce(search.trim(), 250);
  const { data: tags = [] } = useTags();

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Typing a search replaces the history entry instead of adding one per letter
    setParams(next, { replace: Object.keys(changes).every((k) => k === 'q') });
  };

  const filter: FileFilter = {
    q: q || undefined,
    tag: tag || undefined,
    kind: kind || undefined,
    from: from || undefined,
    to: to || undefined,
    starred: view === 'starred' ? true : undefined,
    important: view === 'important' ? true : undefined,
    receipt: view === 'receipts' ? true : undefined,
    linked: view === 'unlinked' ? false : undefined,
  };
  const filesQuery = useFilePages(filter, PAGE);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = filesQuery;
  const upload = useUploadFile();
  const [errors, setErrors] = useState<string[]>([]);
  const docs = data?.pages.flatMap((p) => p.documents) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  async function add(files: File[]) {
    setErrors([]);
    const failed: string[] = [];
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, tagIds: tag ? [tag] : undefined });
      } catch (e) {
        failed.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setErrors(failed);
  }

  // Files shared from another app (the phone's share sheet): the service worker held them on
  // this device; upload them now, then forget them
  const shared = params.get('shared');
  const [sharedNote, setSharedNote] = useState<string | null>(null);
  const took = useRef(false);
  useEffect(() => {
    if (shared === null || took.current) return;
    took.current = true;
    (async () => {
      const files: File[] = [];
      try {
        const cache = await caches.open('flybudget-shared');
        for (const request of await cache.keys()) {
          const res = await cache.match(request);
          if (!res) continue;
          const blob = await res.blob();
          const name = decodeURIComponent(res.headers.get('X-File-Name') ?? 'shared file');
          files.push(new File([blob], name, { type: blob.type }));
        }
        await caches.delete('flybudget-shared');
      } catch {
        // No Cache Storage here: nothing was held
      }
      if (files.length) {
        await add(files);
        setSharedNote(`Added ${files.length} shared ${files.length === 1 ? 'file' : 'files'}.`);
      } else setSharedNote('Nothing was shared. Share a file to Allotment from another app.');
      set({ shared: null });
    })();
    // Runs once per share; add and set read the latest state when it does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  const filtered = !!(q || tag || kind || from || to || view);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Files"
        subtitle="Bills, warranties, policies and receipts, kept with what they belong to"
        actions={
          <a
            href={filesExportUrl()}
            download
            className="inline-flex h-8 max-md:min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs max-md:text-sm font-medium text-text-secondary hover:bg-surface-alt"
          >
            <Download size={13} /> Download all
          </a>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-5 max-md:px-4">
        <div className="flex gap-6 max-md:flex-col">
          <aside
            data-guide="files.views"
            className="w-52 shrink-0 space-y-4 max-md:w-full"
            aria-label="File views"
          >
            <nav className="space-y-0.5 max-md:flex max-md:flex-wrap max-md:gap-1 max-md:space-y-0">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-current={view === v.id ? 'page' : undefined}
                  onClick={() => set({ view: v.id || null })}
                  className={`w-full max-md:w-auto flex items-center gap-2 rounded-md px-2.5 py-1.5 max-md:min-h-11 text-sm text-left ${view === v.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-text-secondary hover:bg-hover'}`}
                >
                  {v.id === 'starred' ? <Star size={14} /> : <FolderOpen size={14} />}
                  {v.label}
                </button>
              ))}
            </nav>
            {tags.length > 0 && (
              <div className="space-y-1">
                <p className="px-2.5 text-2xs uppercase tracking-wide text-text-tertiary">Labels</p>
                <div className="space-y-0.5 max-md:flex max-md:flex-wrap max-md:gap-1 max-md:space-y-0">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-current={tag === t.id ? 'page' : undefined}
                      onClick={() => set({ tag: tag === t.id ? null : t.id })}
                      className={`w-full max-md:w-auto flex items-center gap-2 rounded-md px-2.5 py-1.5 max-md:min-h-11 text-sm text-left ${tag === t.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-text-secondary hover:bg-hover'}`}
                    >
                      <TagIcon size={13} style={{ color: t.color }} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="max-md:hidden">
              <StorageCard />
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-4">
            <div data-guide="files.search" className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <Input
                  className="w-full pl-8"
                  placeholder="Search names, descriptions, labels and what files say"
                  aria-label="Search files"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    set({ q: e.target.value.trim() || null });
                  }}
                />
              </div>
              <Select
                aria-label="Kind of file"
                value={kind}
                onChange={(e) => set({ kind: e.target.value || null })}
                className="w-auto"
              >
                <option value="">Any kind</option>
                {(Object.keys(KIND_LABELS) as FileKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                aria-label="From"
                value={from}
                onChange={(e) => set({ from: e.target.value || null })}
                className="w-auto"
              />
              <Input
                type="date"
                aria-label="To"
                value={to}
                onChange={(e) => set({ to: e.target.value || null })}
                className="w-auto"
              />
            </div>

            <div data-guide="files.add">
              <FileDrop onFiles={add} busy={upload.isPending} label="Add files" />
            </div>
            {sharedNote && (
              <p role="status" className="text-sm text-text-secondary">
                {sharedNote}
              </p>
            )}
            {!loadFailed(filesQuery) && <QueryProblem what="files" query={filesQuery} />}
            {errors.map((e) => (
              <p key={e} role="alert" className="text-sm text-negative">
                {e}
              </p>
            ))}

            {isLoading ? (
              <div className="h-40 bg-surface-alt rounded animate-pulse" />
            ) : loadFailed(filesQuery) ? (
              <QueryProblem what="files" query={filesQuery} />
            ) : docs.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                {filtered
                  ? 'No files match.'
                  : 'No files yet. Add bills, warranties, insurance policies or photos of what you own, then link each to the transactions, categories, goals and accounts it belongs to.'}
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => set({ file: d.id })}
                      aria-label={`Open ${d.fileName}`}
                      className="w-full h-full flex gap-3 rounded-lg border border-border-light bg-surface p-3 text-left hover:border-brand-600"
                    >
                      <FileThumb doc={d} size={56} />
                      <span className="flex-1 min-w-0 space-y-0.5">
                        <span className="flex items-center gap-1 text-sm font-medium text-text">
                          <span className="truncate">{d.fileName}</span>
                          {d.starred && (
                            <Star
                              size={12}
                              className="shrink-0 text-caution"
                              aria-label="Starred"
                            />
                          )}
                        </span>
                        <span className="block text-xs text-text-tertiary truncate">
                          {formatDay(d.date)} · {formatBytes(d.size)}
                          {d.important && ' · Important'}
                          {d.receipt && ' · Receipt'}
                        </span>
                        <span className="block text-xs text-text-secondary truncate">
                          {d.links.length ? d.links.map((l) => l.label).join(', ') : 'Not linked'}
                        </span>
                        {d.tags.length > 0 && (
                          <span className="flex flex-wrap gap-1 pt-0.5">
                            {d.tags.map((t) => (
                              <span
                                key={t.id}
                                className="rounded-full px-1.5 py-px text-[10px] font-medium text-white"
                                style={{ backgroundColor: t.color }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {hasNextPage && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Show more ({total - docs.length} more)
              </Button>
            )}
            <div className="md:hidden">
              <StorageCard />
            </div>
            <p className="text-xs text-text-tertiary">
              Files stay on your own server with the budget, never sent anywhere. Removing a link
              keeps the file; deleting a file removes its links. JSON backups carry files' details,
              not the files: use Download all to keep a copy of the files themselves.
            </p>
          </div>
        </div>
      </div>
      <FileDetailModal id={openId} onClose={() => set({ file: null })} />
    </div>
  );
}

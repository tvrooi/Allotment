import { useRef, useState } from 'react';
import { GuideLink } from '../guide/GuideLink';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import {
  restoreBackup,
  restoreBackupArchive,
  type ArchiveRestoreResult,
  type RestoreResult,
} from '../../api/backup';
import { IS_DEMO, downloadFromApi } from '../../demo/demoApi';
import { YnabImportModal } from '../transactions/YnabImportModal';
import { decimalSeparator, useAmountStyle } from '../../utils/currency';

const API_BASE = '/api/export';

// The server sends these as downloads; the demo's in-browser API can only answer fetch
const download = (url: string) =>
  IS_DEMO ? void downloadFromApi(url) : void (window.location.href = url);

export function DataExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const decimalComma = decimalSeparator(useAmountStyle().format) === ',';
  const fileInput = useRef<HTMLInputElement>(null);
  // A JSON backup is read here; a backup with files (a ZIP) goes to the server as it is
  const [pending, setPending] = useState<
    | { name: string; data: unknown; archive?: undefined }
    | { name: string; archive: File; data?: undefined }
    | null
  >(null);
  const [restoring, setRestoring] = useState(false);
  const [showYnab, setShowYnab] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const queryClient = useQueryClient();

  async function chooseBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setRestoreMessage(null);
    // A ZIP by its first bytes ("PK\x03\x04"), whatever the file is called
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
      if (IS_DEMO) {
        setRestoreMessage({ ok: false, text: 'A backup with files needs the Allotment app.' });
        return;
      }
      setPending({ name: file.name, archive: file });
      return;
    }
    try {
      setPending({ name: file.name, data: JSON.parse(await file.text()) });
    } catch {
      setRestoreMessage({ ok: false, text: `${file.name} is not an Allotment backup file.` });
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setRestoring(true);
    try {
      const result: RestoreResult | ArchiveRestoreResult = pending.archive
        ? await restoreBackupArchive(pending.archive)
        : await restoreBackup(pending.data);
      const count = result.restored.transactions ?? 0;
      const files = 'files' in result ? (result as ArchiveRestoreResult).files : null;
      setRestoreMessage({
        ok: true,
        text:
          `Restored ${pending.name} (${count.toLocaleString()} transactions` +
          (files
            ? `, ${(files.added + files.alreadyHere).toLocaleString()} file${files.added + files.alreadyHere === 1 ? '' : 's'}` +
              (files.missing ? `; ${files.missing.toLocaleString()} not in the ZIP` : '')
            : '') +
          ').' +
          (result.safetyCopy
            ? ` Your previous data was saved as ${result.safetyCopy} next to the database.`
            : ''),
      });
      // Everything on screen is from before the restore
      await queryClient.invalidateQueries();
    } catch (err) {
      setRestoreMessage({ ok: false, text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoring(false);
      setPending(null);
    }
  }

  function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    // Spreadsheets in languages with a decimal comma expect 12,50 and ; between columns
    if (decimalComma) params.set('decimal', 'comma');
    const qs = params.toString();
    download(`${API_BASE}/transactions/csv${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-text">Data export</h2>
        <p className="text-xs text-text-tertiary mt-0.5">
          Download your data for backup or analysis.
        </p>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">Export transactions</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Download all transactions as a CSV file. Optionally filter by date range.
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            {decimalComma
              ? 'Amounts are written like -12,50, with semicolons between columns, '
              : 'Amounts are written like -12.50, with commas between columns, '}
            following your number format in{' '}
            <Link to="/settings?tab=preferences" className="underline hover:text-text-secondary">
              Preferences
            </Link>
            . Report exports use the same separator.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            />
          </div>
          <Button onClick={downloadCsv} size="sm">
            <Download size={14} /> Download CSV
          </Button>
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">Import from YNAB</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Bring over a YNAB register export: one account for each YNAB account, with your
            categories. To import a bank's CSV into one account, open that account and use Import.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowYnab(true)}>
          <Upload size={14} /> From YNAB…
        </Button>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">Full backup</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Download a JSON backup of your budget: accounts, transactions, budgets, categories,
            payees, rules, recurring transactions, goals, reports, dashboards, receipt details and
            tax claims. <strong>Download backup</strong> is that alone, as JSON.{' '}
            {!IS_DEMO && (
              <>
                <strong>Backup with files</strong> is a ZIP of the same backup plus every file
                (receipt photos, PDFs, documents and videos in Files), so another installation gets
                them too.{' '}
              </>
            )}
            Neither holds bank connection credentials, passwords or the encryption key.{' '}
            <GuideLink page="backups" className="font-medium text-brand-600 hover:text-brand-700">
              How backups work
            </GuideLink>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              download(`${API_BASE}/backup`);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-surface bg-text-secondary rounded-md hover:opacity-90 transition-colors"
          >
            <Download size={14} /> Download backup
          </button>
          {!IS_DEMO && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                download('/api/backup-archive');
              }}
            >
              <Download size={14} /> Backup with files (.zip)
            </Button>
          )}
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">Restore from backup</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Replace all of your data with a backup file: a JSON backup, or a backup with files
            (.zip), whose files are checked before anything changes. A copy of your current data is
            saved first.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={
            IS_DEMO ? 'application/json,.json' : 'application/json,.json,application/zip,.zip'
          }
          className="hidden"
          aria-label="Backup file"
          onChange={chooseBackup}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={restoring}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={14} /> {restoring ? 'Restoring…' : 'Restore backup…'}
        </Button>
        {restoreMessage && (
          <p
            role="status"
            className={`text-xs ${restoreMessage.ok ? 'text-text-secondary' : 'text-red-600'}`}
          >
            {restoreMessage.text}
          </p>
        )}
      </div>

      <YnabImportModal isOpen={showYnab} onClose={() => setShowYnab(false)} />
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmRestore}
        title="Restore this backup?"
        message={`All of your current data will be replaced with the contents of ${pending?.name ?? 'the backup'}. Bank connections stay connected.`}
        confirmLabel="Replace my data"
        danger
      />
    </div>
  );
}

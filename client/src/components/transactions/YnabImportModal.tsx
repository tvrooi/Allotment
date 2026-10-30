import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useBudgetCurrency } from '../../hooks/useCurrency';
import { createAccount } from '../../api/accounts';
import {
  importConfirm,
  linkImportedTransfers,
  type ImportResult,
  type ImportRow,
} from '../../api/transactions';
import { pairYnabTransfers } from '../../utils/ynabTransfers';
import { minorUnits } from '../../utils/currencies';
import {
  buildImportRows,
  decodeCsvBytes,
  describeSkippedRows,
  detectDateFormat,
  detectDelimiter,
  detectNumberFormat,
  fileCategoryKey,
  guessColumnRoles,
  parseCsvRecords,
  type ColumnRole,
  type DateFormat,
  type NumberFormat,
  type SkippedRow,
} from '../../utils/csv';
import {
  ImportCategories,
  distinctFileCategories,
  resolveCategoryChoices,
  suggestChoices,
  type CategoryChoice,
} from './ImportCategories';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function YnabImportModal(props: Props) {
  return props.isOpen ? <YnabImportDialog {...props} /> : null;
}

const DATE_LABELS: Record<DateFormat, string> = {
  mdy: 'MM/DD/YYYY',
  dmy: 'DD/MM/YYYY',
  ymd: 'YY/MM/DD',
};
const NUMBER_LABELS: Record<NumberFormat, string> = { dot: '1,234.56', comma: '1.234,56' };
const READY_TO_ASSIGN = /^(ready to assign|available this month|to be budgeted)$/i;
const selectClass = 'w-full text-xs border border-border rounded px-1.5 py-1 bg-surface text-text';

/** Where one YNAB account's rows go: an account made for the import, or one that exists */
type Target = { kind: 'new'; name: string } | { kind: 'existing'; accountId: string };

interface Parsed {
  roles: ColumnRole[];
  accountIdx: number;
  /** Rows (as in the file) per YNAB account, in file order */
  byAccount: Map<string, string[][]>;
  allRows: string[][];
}

/** YNAB's "Account" column marks its register export; other files go through the account import */
function parseYnab(text: string): Parsed | string {
  const records = parseCsvRecords(text, detectDelimiter(text));
  const headers = records[0] ?? [];
  const names = headers.map((h) => h.trim().toLowerCase());
  const accountIdx = names.indexOf('account');
  const roles = guessColumnRoles(headers);
  const hasMoney =
    roles.includes('outflow') || roles.includes('inflow') || roles.includes('amount');
  if (accountIdx === -1 || !roles.includes('date') || !hasMoney)
    return "This doesn't look like a YNAB register export. It needs Account, Date and Outflow/Inflow columns. To import one account from another bank or app, use Import on that account instead.";
  const allRows = records.slice(1);
  const byAccount = new Map<string, string[][]>();
  for (const row of allRows) {
    const name = (row[accountIdx] ?? '').trim() || 'Account';
    byAccount.set(name, [...(byAccount.get(name) ?? []), row]);
  }
  if (!byAccount.size) return 'There are no transactions in this file.';
  return { roles, accountIdx, byAccount, allRows };
}

function YnabImportDialog({ onClose }: Props) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState('');
  const [dateChoice, setDateChoice] = useState<DateFormat | null>(null);
  const [numberChoice, setNumberChoice] = useState<NumberFormat | null>(null);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [choices, setChoices] = useState<Record<string, CategoryChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; accountId: string; result: ImportResult }[]>([]);
  const [finished, setFinished] = useState(false);
  const [linkedTransfers, setLinkedTransfers] = useState(0);
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();
  const budgetCurrency = useBudgetCurrency();
  const canSave = useCanSave();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loadId = useRef(0);

  async function handleFile(file: File) {
    setError(null);
    const load = ++loadId.current;
    try {
      const text = decodeCsvBytes(await file.arrayBuffer(), 'auto');
      if (load !== loadId.current) return;
      const result = parseYnab(text);
      if (typeof result === 'string') return setError(result);
      setParsed(result);
      setFileName(file.name);
      setDateChoice(null);
      setNumberChoice(null);
      setTargets(
        Object.fromEntries(
          [...result.byAccount.keys()].map((name) => {
            const same = accounts.find(
              (a) => !a.closedAt && a.name.trim().toLowerCase() === name.toLowerCase(),
            );
            return [
              name,
              same
                ? { kind: 'existing' as const, accountId: same.id }
                : { kind: 'new' as const, name },
            ];
          }),
        ),
      );
    } catch {
      setError("Couldn't read this file");
    }
  }

  const column = (role: ColumnRole) => {
    const idx = parsed?.roles.indexOf(role) ?? -1;
    return idx === -1 || !parsed ? [] : parsed.allRows.map((r) => r[idx] ?? '');
  };
  const detectedDate = useMemo(
    () => (parsed ? detectDateFormat(column('date')) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed],
  );
  const detectedNumber = useMemo(
    () =>
      parsed
        ? detectNumberFormat([...column('amount'), ...column('inflow'), ...column('outflow')])
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed],
  );
  const dateFormat = dateChoice ?? detectedDate;
  const numberFormat = numberChoice ?? detectedNumber;

  // Every YNAB account's rows, read with the formats above
  const built = useMemo(() => {
    if (!parsed || !dateFormat || !numberFormat) return null;
    const out = new Map<string, { rows: ImportRow[]; skipped: SkippedRow[] }>();
    for (const [name, rows] of parsed.byAccount) {
      const result = buildImportRows(rows, parsed.roles, {
        dateFormat,
        numberFormat,
        minor: minorUnits(budgetCurrency),
      });
      if (typeof result === 'string') return result;
      // YNAB files income under "Inflow: Ready to Assign": that is not a category to budget
      out.set(name, {
        ...result,
        rows: result.rows.map(({ fileCategory, ...row }) =>
          fileCategory && READY_TO_ASSIGN.test(fileCategory.name) ? row : { ...row, fileCategory },
        ),
      });
    }
    return out;
  }, [parsed, dateFormat, numberFormat, budgetCurrency]);

  const allRows = useMemo(
    () => (built && typeof built !== 'string' ? [...built.values()].flatMap((b) => b.rows) : []),
    [built],
  );
  const uses = useMemo(() => distinctFileCategories(allRows), [allRows]);
  // Suggested again whenever the file's categories change (a different date format reads rows anew)
  const suggestedFor = useRef('');
  const usesKey = uses.map((u) => u.key).join('|');
  if (suggestedFor.current !== usesKey && groups.length) {
    suggestedFor.current = usesKey;
    setChoices(suggestChoices(uses, groups));
  }

  async function runImport() {
    if (!built || typeof built === 'string' || !parsed) return;
    setBusy(true);
    setError(null);
    try {
      const made = uses.length ? await resolveCategoryChoices(uses, choices) : {};
      if (uses.length) await queryClient.invalidateQueries({ queryKey: ['categories'] });
      const finishedNow = [...done];
      for (const [name, { rows }] of built) {
        if (finishedNow.some((d) => d.name === name)) continue;
        let target = targets[name];
        if (target.kind === 'new') {
          // A retry after a failure must find this account, not make a second one
          const account = await createAccount({
            name: target.name.trim() || name,
            type: 'checking',
            startingBalance: 0,
          });
          target = { kind: 'existing', accountId: account.id };
          setTargets((t) => ({ ...t, [name]: target }));
          await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        }
        const accountId = (target as { accountId: string }).accountId;
        const result = await importConfirm(
          accountId,
          rows.map((row) => ({
            ...row,
            categoryId: row.fileCategory ? (made[fileCategoryKey(row.fileCategory)] ?? null) : null,
          })),
        );
        finishedNow.push({ name, accountId, result });
        setDone([...finishedNow]);
      }
      // Both legs of a transfer came in with this file: link them (exact mirrors only)
      const idOf = new Map(finishedNow.map((d) => [d.name, d.accountId]));
      const pairs = pairYnabTransfers(new Map([...built].map(([name, b]) => [name, b.rows])))
        .filter((p) => idOf.has(p.account) && idOf.has(p.otherAccount))
        .map((p) => ({
          accountId: idOf.get(p.account)!,
          importedId: p.importedId,
          otherAccountId: idOf.get(p.otherAccount)!,
          otherImportedId: p.otherImportedId,
        }));
      if (pairs.length) setLinkedTransfers((await linkImportedTransfers(pairs)).linked);
      setFinished(true);
      await queryClient.invalidateQueries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  const accountNames = parsed ? [...parsed.byAccount.keys()] : [];
  const skippedAll =
    built && typeof built !== 'string' ? [...built.values()].flatMap((b) => b.skipped) : [];
  const total = allRows.length;
  const newNameClash = accountNames.some((n) => {
    const t = targets[n];
    return (
      t?.kind === 'new' &&
      accounts.some(
        (a) => !a.closedAt && a.name.trim().toLowerCase() === t.name.trim().toLowerCase(),
      )
    );
  });

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title="Import from YNAB" size="xl">
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-negative-subtle text-negative rounded-lg"
          >
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {!parsed && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => document.getElementById('ynab-file-input')?.click()}
            className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-border rounded-lg hover:border-brand-400 transition-colors cursor-pointer"
          >
            <Upload size={32} className="text-text-tertiary" />
            <p className="text-sm text-text-secondary text-center px-4">
              Choose the register export from YNAB (Export All Plan Data → Register.csv). It brings
              each account, its transactions and their categories.
            </p>
            <input
              id="ynab-file-input"
              type="file"
              accept=".csv,.txt"
              aria-label="YNAB register file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {parsed && !finished && (
          <>
            <p className="text-sm text-text-secondary">
              {fileName}: {parsed.allRows.length.toLocaleString()} transactions in{' '}
              {accountNames.length} account{accountNames.length === 1 ? '' : 's'}.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <label className="text-xs font-medium text-text-tertiary space-y-1">
                <span>Dates</span>
                <select
                  aria-label="Date format"
                  value={dateFormat ?? ''}
                  onChange={(e) => setDateChoice(e.target.value as DateFormat)}
                  className={selectClass}
                >
                  {!dateFormat && <option value="">Choose…</option>}
                  {Object.entries(DATE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-text-tertiary space-y-1">
                <span>Amounts</span>
                <select
                  aria-label="Amount format"
                  value={numberFormat ?? ''}
                  onChange={(e) => setNumberChoice(e.target.value as NumberFormat)}
                  className={selectClass}
                >
                  {!numberFormat && <option value="">Choose…</option>}
                  {Object.entries(NUMBER_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(!dateFormat || !numberFormat) && (
              <p className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  This file doesn't show how it writes {!dateFormat ? 'dates' : 'amounts'}. Choose
                  the format YNAB used, so nothing lands on the wrong day or in the wrong amount.
                </span>
              </p>
            )}
            {typeof built === 'string' && <p className="text-sm text-negative">{built}</p>}

            {built && typeof built !== 'string' && (
              <>
                <section aria-label="Accounts" className="space-y-2">
                  <h3 className="text-sm font-semibold text-text">Accounts</h3>
                  <p className="text-xs text-text-secondary">
                    One Allotment account for each YNAB account. New accounts start at $0.00 and
                    follow their transactions, the way YNAB's own starting balance entries do.
                  </p>
                  <div className="border border-border rounded-lg divide-y divide-border-light">
                    {accountNames.map((name) => {
                      const target = targets[name];
                      const count = built.get(name)?.rows.length ?? 0;
                      return (
                        <div
                          key={name}
                          className="p-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 items-start"
                        >
                          <p className="text-sm text-text">
                            {name}{' '}
                            <span className="text-xs text-text-tertiary">
                              · {count.toLocaleString()} transactions
                            </span>
                          </p>
                          <div className="space-y-1">
                            <select
                              aria-label={`Allotment account for ${name}`}
                              className={selectClass}
                              disabled={busy || done.some((d) => d.name === name)}
                              value={target?.kind === 'existing' ? target.accountId : '__new'}
                              onChange={(e) =>
                                setTargets((t) => ({
                                  ...t,
                                  [name]:
                                    e.target.value === '__new'
                                      ? { kind: 'new', name }
                                      : { kind: 'existing', accountId: e.target.value },
                                }))
                              }
                            >
                              <option value="__new">Create a new account</option>
                              {accounts
                                .filter((a) => !a.closedAt)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    Add to {a.name}
                                  </option>
                                ))}
                            </select>
                            {target?.kind === 'new' && (
                              <input
                                aria-label={`Name for ${name}`}
                                className={selectClass}
                                value={target.name}
                                maxLength={200}
                                disabled={busy}
                                onChange={(e) =>
                                  setTargets((t) => ({
                                    ...t,
                                    [name]: { kind: 'new', name: e.target.value },
                                  }))
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {newNameClash && (
                    <p className="text-xs text-caution">
                      An account with that name already exists. You can still create another, or
                      choose “Add to” the existing one.
                    </p>
                  )}
                </section>

                {uses.length > 0 && (
                  <section aria-label="Categories" className="space-y-2">
                    <h3 className="text-sm font-semibold text-text">Categories</h3>
                    <p className="text-xs text-text-secondary">
                      Matching names are picked for you. Anything you leave as Uncategorised can be
                      sorted later. “Ready to Assign” income stays uncategorised.
                    </p>
                    <ImportCategories
                      uses={uses}
                      groups={groups}
                      choices={choices}
                      onChange={setChoices}
                    />
                  </section>
                )}

                {skippedAll.length > 0 && (
                  <p role="status" className="text-xs text-caution">
                    {describeSkippedRows(skippedAll)} They are left out.
                  </p>
                )}
                <SavingPausedHint className="text-right" />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={onClose} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={() => void runImport()} disabled={busy || !canSave || !total}>
                    {busy ? 'Importing...' : `Import ${total.toLocaleString()} transactions`}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {finished && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle size={40} className="text-positive" />
            <div className="text-center">
              <p className="text-sm font-medium text-text">Import complete</p>
              <ul className="text-sm text-text-secondary mt-1 space-y-0.5">
                {done.map((d) => (
                  <li key={d.accountId}>
                    {d.name}: {d.result.imported} imported
                    {d.result.skipped ? `, ${d.result.skipped} skipped` : ''}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-secondary mt-2" role="status">
                {linkedTransfers > 0
                  ? `${linkedTransfers} transfer${linkedTransfers === 1 ? '' : 's'} between these accounts linked.`
                  : 'No transfers between these accounts were found to link.'}
              </p>
            </div>
            <Button
              onClick={() => {
                onClose();
                if (done.length === 1) navigate(`/accounts/${done[0].accountId}`);
                else navigate('/accounts');
              }}
            >
              {done.length === 1 ? 'View the account' : 'View accounts'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

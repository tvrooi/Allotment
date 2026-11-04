import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ExternalLink as ExternalIcon, Lock, LockOpen, Plus } from 'lucide-react';
import {
  ASSET_LABELS,
  ATO_EFFECTIVE_LIFE_URL,
  LIVES_CHECKED,
  SUGGESTED_LIVES,
  assetScheduleCsvUrl,
  createAsset,
  deleteAsset,
  disposeAsset,
  fyName,
  fyOf,
  lodgeYear,
  previewAsset,
  setYearWorkUse,
  undisposeAsset,
  unlodgeYear,
  updateAsset,
  type Asset,
  type AssetInput,
  type AssetLabel,
  type AssetMethod,
  type Preview,
  poolAsset,
  unpoolAsset,
} from '../../api/assets';
import { TAX_LABEL_NAMES } from '../../api/tax';
import { useAssetMutation, useAssets, useLodgedYears, usePool } from '../../hooks/useAssets';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ExternalLink } from '../ui/ExternalLink';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { FilesSection } from '../files/FilesSection';
import { formatCurrency } from '../../utils/currency';
import { formatDay } from '../../utils/dates';

// Tax time → Assets (docs/DEPRECIATING-ASSETS-PLAN.md, phase 2): things that lose value over
// several years, each with its decline in value worked out the ATO's two ways. Record keeping
// for the return, not tax advice; the purchase stays an expense in its category.

const METHOD_NAMES: Record<AssetMethod, string> = {
  prime_cost: 'Prime cost',
  diminishing_value: 'Diminishing value',
};
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
const today = () => new Date().toISOString().slice(0, 10);

/** What "Depreciate instead" or a transaction's details hand over */
export type AssetPrefill = {
  transactionId: string;
  name: string;
  cost: number;
  date: string;
  /** The purchase is claimed outright now: the asset replaces that claim */
  claimed?: boolean;
  label?: AssetLabel;
  workUseBps?: number;
};

export function AssetsTab() {
  const { data: assets = [], isLoading } = useAssets();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as { asset?: AssetPrefill } | null)?.asset ?? null;
  const [adding, setAdding] = useState<AssetPrefill | 'blank' | null>(prefill);
  useEffect(() => {
    if (prefill) {
      setAdding(prefill);
      // Used once: going back to the tab doesn't open the form again
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [prefill, navigate, location.pathname, location.search]);
  const openId = params.get('asset');
  const open = assets.find((a) => a.id === openId) ?? null;
  const thisFy = fyOf(today());

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-text-secondary flex-1 min-w-60">
          Things that lose value over several years, such as a laptop for work, and the part you can
          claim each year. The purchase stays an expense in its category.
        </p>
        <a href={assetScheduleCsvUrl(thisFy)} download>
          <Button variant="secondary">
            <Download size={14} /> Schedule {fyName(thisFy)} (CSV)
          </Button>
        </a>
        <Button onClick={() => setAdding('blank')}>
          <Plus size={14} /> Add an asset
        </Button>
      </div>

      {isLoading ? null : assets.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No assets yet. Add one, or choose <em>Depreciate instead</em> on a claim over $300 in
          Deductions.
        </p>
      ) : (
        <section aria-label="Assets" className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="text-left text-xs text-text-tertiary">
                <th className="py-1.5 font-medium">Asset</th>
                <th className="font-medium">Label</th>
                <th className="font-medium">Method</th>
                <th className="text-right font-medium">Cost</th>
                <th className="text-right font-medium">Decline {fyName(thisFy)}</th>
                <th className="text-right font-medium">Deduction</th>
                <th className="text-right font-medium">Value now</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const row = a.schedule.find((r) => r.financialYear === thisFy);
                const last = [...a.schedule].reverse().find((r) => r.financialYear <= thisFy);
                return (
                  <tr key={a.id} className="border-t border-border-light">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setParams({ tab: 'assets', asset: a.id }, { replace: true })}
                        className="text-left font-medium text-brand-600 hover:text-brand-700"
                      >
                        {a.name}
                      </button>
                      {a.disposedDate && (
                        <span className="block text-xs text-text-tertiary">
                          Disposed {formatDay(a.disposedDate)}
                        </span>
                      )}
                    </td>
                    <td>{a.label}</td>
                    <td>{METHOD_NAMES[a.method]}</td>
                    <td className="text-right tabular-nums">{formatCurrency(a.cost)}</td>
                    <td className="text-right tabular-nums">
                      {a.pooledFy !== null && thisFy >= a.pooledFy
                        ? 'In the pool'
                        : formatCurrency(row?.decline ?? 0)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(row?.deduction ?? 0)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(last ? last.closing : a.cost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <PoolSection assets={assets} />

      <LodgedYears assets={assets} />

      <p className="text-xs text-text-tertiary">
        Decline in value follows the ATO&rsquo;s Guide to depreciating assets: prime cost (the same
        amount each year) or diminishing value (200% of a falling value). Keep an asset&rsquo;s
        records while you have it, and for five years after the last claim or after you dispose of
        it.
      </p>

      {adding && (
        <AssetForm
          prefill={adding === 'blank' ? null : adding}
          onClose={() => setAdding(null)}
          onSaved={(a) => {
            setAdding(null);
            setParams({ tab: 'assets', asset: a.id }, { replace: true });
          }}
        />
      )}
      {open && (
        <AssetDetail asset={open} onClose={() => setParams({ tab: 'assets' }, { replace: true })} />
      )}
    </div>
  );
}

/** Years marked lodged: their asset figures stay as lodged until unlocked */
function LodgedYears({ assets }: { assets: Asset[] }) {
  const { data: lodged = [] } = useLodgedYears();
  const lodge = useAssetMutation(lodgeYear);
  const unlodge = useAssetMutation(unlodgeYear);
  const { data: pool = [] } = usePool();
  // Every year with figures to lock: assets' own schedules and the low-value pool's
  const years = [
    ...new Set([
      ...assets.flatMap((a) => a.schedule.map((r) => r.financialYear)),
      ...pool.map((r) => r.financialYear),
      ...lodged,
    ]),
  ]
    .filter((fy) => fy <= fyOf(today()))
    .sort((a, b) => b - a);
  if (!years.length) return null;
  return (
    <section aria-labelledby="lodged-heading" className="space-y-2">
      <h2 id="lodged-heading" className="text-sm font-semibold text-text">
        Lodged years
      </h2>
      <p className="text-xs text-text-tertiary">
        Once a year is lodged, lock it so a later change can&rsquo;t alter the figures you lodged.
      </p>
      <ul className="flex flex-wrap gap-2">
        {years.map((fy) => {
          const isLodged = lodged.includes(fy);
          return (
            <li key={fy}>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={isLodged}
                disabled={lodge.isPending || unlodge.isPending}
                onClick={() => (isLodged ? unlodge.mutate(fy) : lodge.mutate(fy))}
              >
                {isLodged ? <Lock size={13} /> : <LockOpen size={13} />} {fyName(fy)}
                {isLodged ? ' lodged' : ''}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The low-value pool (D6): one balance for every asset in it, year by year */
function PoolSection({ assets }: { assets: Asset[] }) {
  const { data: rows = [] } = usePool();
  if (!rows.length) return null;
  const pooled = assets.filter((a) => a.pooledFy !== null);
  return (
    <section aria-labelledby="pool-heading" className="space-y-2">
      <h2 id="pool-heading" className="text-sm font-semibold text-text">
        Low-value pool (D6)
      </h2>
      <p className="text-xs text-text-tertiary">
        {pooled.map((a) => a.name).join(', ')}. Low-cost assets are written down 18.75% in their
        first year, and the balance 37.5% a year after that.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[36rem]">
          <thead>
            <tr className="text-left text-xs text-text-tertiary">
              <th className="py-1 font-medium">Year</th>
              <th className="text-right font-medium">Opening</th>
              <th className="text-right font-medium">Added</th>
              <th className="text-right font-medium">Deduction</th>
              <th className="text-right font-medium">Disposals</th>
              <th className="text-right font-medium">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.financialYear} className="border-t border-border-light">
                <td className="py-1.5">{fyName(r.financialYear)}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.opening)}</td>
                <td className="text-right tabular-nums">
                  {formatCurrency(r.lowCostAdded + r.lowValueAdded)}
                </td>
                <td className="text-right tabular-nums">{formatCurrency(r.decline)}</td>
                <td className="text-right tabular-nums">
                  {formatCurrency(r.terminations)}
                  {r.income > 0 && (
                    <span className="block text-xs text-text-tertiary">
                      {formatCurrency(r.income)} income
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums">{formatCurrency(r.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Allocate an asset to the pool, or take it back out (a correction) */
function PoolChoice({ asset, onError }: { asset: Asset; onError: (e: unknown) => void }) {
  const [fy, setFy] = useState(asset.poolOptions[0]?.financialYear ?? 0);
  // The year shown is the one sent: `fy` can be stale once options change (after unpooling)
  const join = useAssetMutation((year: number) => poolAsset(asset.id, year));
  const leave = useAssetMutation(() => unpoolAsset(asset.id));
  if (asset.pooledFy !== null)
    return (
      <section
        aria-label="Low-value pool"
        className="rounded-md bg-surface-alt p-3 text-sm space-y-2"
      >
        <p>
          In the low-value pool from {fyName(asset.pooledFy)}: its decline is part of the pool’s D6
          deduction from then on, so it has no schedule of its own after that.
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={leave.isPending}
          onClick={() => leave.mutateAsync(undefined).catch(onError)}
        >
          Take it out of the pool
        </Button>
        <p className="text-xs text-text-tertiary">
          Only to correct a mistake: once pooled, an asset stays pooled.
        </p>
      </section>
    );
  if (!asset.poolOptions.length) return null;
  const option = asset.poolOptions.find((o) => o.financialYear === fy) ?? asset.poolOptions[0];
  return (
    <section
      aria-label="Low-value pool"
      className="rounded-md bg-surface-alt p-3 text-sm space-y-2"
    >
      <p>
        {option.kind === 'low_cost'
          ? 'It cost under $1,000, so it can go into the low-value pool in its first year (18.75% that year, whatever the date, then 37.5% a year).'
          : 'Its value is under $1,000, so it can join the low-value pool (37.5% a year).'}{' '}
        It would add {formatCurrency(option.amount)}, its work-use share. Once you pool a low-cost
        asset, the ATO expects every later low-cost asset to be pooled too.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {asset.poolOptions.length > 1 && (
          <Select
            aria-label="Pool from"
            value={fy}
            onChange={(e) => setFy(Number(e.target.value))}
            className="w-32"
          >
            {asset.poolOptions.map((o) => (
              <option key={o.financialYear} value={o.financialYear}>
                {fyName(o.financialYear)}
              </option>
            ))}
          </Select>
        )}
        <Button
          size="sm"
          disabled={join.isPending}
          onClick={() => join.mutateAsync(option.financialYear).catch(onError)}
        >
          Move to the pool from {fyName(option.financialYear)}
        </Button>
      </div>
    </section>
  );
}

function ScheduleTable({ rows, caption }: { rows: Preview['prime_cost']; caption: string }) {
  return (
    <table className="w-full text-xs">
      <caption className="text-left font-medium text-text-secondary pb-1">{caption}</caption>
      <thead>
        <tr className="text-text-tertiary">
          <th className="text-left font-medium py-1">Year</th>
          <th className="text-right font-medium">Days</th>
          <th className="text-right font-medium">Decline</th>
          <th className="text-right font-medium">Deduction</th>
          <th className="text-right font-medium">Closing value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.financialYear} className="border-t border-border-light">
            <td className="py-1">{fyName(r.financialYear)}</td>
            <td className="text-right tabular-nums">{r.daysHeld}</td>
            <td className="text-right tabular-nums">{formatCurrency(r.decline)}</td>
            <td className="text-right tabular-nums">
              {formatCurrency(r.deduction)}
              {r.workUseBps !== 10_000 && (
                <span className="text-text-tertiary"> ({pct(r.workUseBps)})</span>
              )}
            </td>
            <td className="text-right tabular-nums">{formatCurrency(r.closing)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AssetForm({
  prefill,
  asset,
  onClose,
  onSaved,
}: {
  prefill: AssetPrefill | null;
  asset?: Asset;
  onClose: () => void;
  onSaved: (a: Asset) => void;
}) {
  const [name, setName] = useState(asset?.name ?? prefill?.name ?? '');
  const [label, setLabel] = useState<AssetLabel>(asset?.label ?? prefill?.label ?? 'D5');
  const [cost, setCost] = useState(asset?.cost ?? prefill?.cost ?? 0);
  const [startDate, setStartDate] = useState(asset?.startDate ?? prefill?.date ?? today());
  const [life, setLife] = useState(asset ? String(asset.effectiveLifeHundredths / 100) : '');
  const [workUse, setWorkUse] = useState(
    String((asset?.workUseBps ?? prefill?.workUseBps ?? 10_000) / 100),
  );
  const [method, setMethod] = useState<AssetMethod>(asset?.method ?? 'diminishing_value');
  const [partOfSet, setPartOfSet] = useState(asset?.partOfSet ?? false);
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useAssetMutation((input: AssetInput) =>
    asset ? updateAsset(asset.id, input) : createAsset(input),
  );

  const lifeHundredths = Math.round(Number(life) * 100);
  const workUseBps = Math.round(Number(workUse) * 100);
  const valid =
    cost > 0 &&
    lifeHundredths > 0 &&
    workUseBps >= 1 &&
    workUseBps <= 10_000 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  useEffect(() => {
    if (!valid) return setPreview(null);
    let live = true;
    const timer = setTimeout(() => {
      previewAsset({ cost, startDate, effectiveLifeHundredths: lifeHundredths, workUseBps })
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [valid, cost, startDate, lifeHundredths, workUseBps]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const saved = (await save.mutateAsync({
        name: name.trim(),
        label,
        cost,
        startDate,
        effectiveLifeHundredths: lifeHundredths,
        workUseBps,
        method,
        partOfSet,
        notes: notes.trim() || null,
        ...(asset ? {} : { transactionId: prefill?.transactionId ?? null }),
        ...(prefill?.claimed ? { replaceClaim: true } : {}),
      })) as Asset;
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the asset');
    }
  }

  const field = 'block text-xs font-medium text-text-secondary space-y-1';
  return (
    <Modal isOpen onClose={onClose} title={asset ? `Edit ${asset.name}` : 'Add an asset'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {prefill?.claimed && (
          <p role="note" className="rounded-md border border-caution p-3 text-sm text-caution">
            This purchase is claimed outright now. Saving the asset replaces that claim with its
            decline in value, year by year.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="asset-name" className="block">
              Name
            </label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <label className={field}>
            <span className="block">Tax return label</span>
            <Select value={label} onChange={(e) => setLabel(e.target.value as AssetLabel)}>
              {ASSET_LABELS.map((l) => (
                <option key={l} value={l}>
                  {l} {TAX_LABEL_NAMES[l] ?? ''}
                </option>
              ))}
            </Select>
          </label>
          <div className={field}>
            <span className="block">Cost (what you paid, GST included)</span>
            <CurrencyInput value={cost} onChange={setCost} aria-label="Cost" />
          </div>
          <div className={field}>
            <label htmlFor="asset-start" className="block">
              Start date (first used or installed ready for use)
            </label>
            <Input
              id="asset-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <label className={field}>
            <span className="block">Effective life (years)</span>
            <Input
              inputMode="decimal"
              value={life}
              onChange={(e) => setLife(e.target.value)}
              placeholder="e.g. 2"
              required
              list="asset-lives"
            />
            <datalist id="asset-lives">
              {SUGGESTED_LIVES.map((s) => (
                <option key={s.item} value={s.years}>
                  {s.item}
                </option>
              ))}
            </datalist>
          </label>
          <div className={field}>
            <label htmlFor="asset-work-use" className="block">
              Work use (%)
            </label>
            <Input
              id="asset-work-use"
              inputMode="decimal"
              value={workUse}
              onChange={(e) => setWorkUse(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="text-xs text-text-tertiary space-y-1">
          <p>
            Suggested effective lives:{' '}
            {SUGGESTED_LIVES.map((s, i) => (
              <span key={s.item}>
                {i > 0 && ', '}
                <button
                  type="button"
                  className="text-brand-600 hover:text-brand-700 max-md:min-h-11"
                  onClick={() => setLife(String(s.years))}
                >
                  {s.item.toLowerCase()} {s.years} years
                </button>
              </span>
            ))}
            . From the ATO&rsquo;s table, checked {LIVES_CHECKED}; the ATO revises them.{' '}
            <ExternalLink href={ATO_EFFECTIVE_LIFE_URL}>
              Find yours <ExternalIcon size={11} className="inline" />
            </ExternalLink>
          </p>
        </div>
        {cost > 0 && cost <= 30_000 && (
          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={partOfSet}
              onChange={(e) => setPartOfSet(e.target.checked)}
              className="mt-1"
            />
            <span>
              Part of a set, or one of several identical items, costing over $300 in total this year
              <span className="block text-xs text-text-tertiary">
                Otherwise an item of $300 or less is claimed at once in Deductions.
              </span>
            </span>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-text-secondary">Method</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {(['diminishing_value', 'prime_cost'] as AssetMethod[]).map((m) => (
              <label
                key={m}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm max-md:min-h-11 ${
                  method === m ? 'border-brand-500 bg-brand-50' : 'border-border'
                } ${asset?.lodgedYears.length ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  disabled={!!asset?.lodgedYears.length}
                  onChange={() => setMethod(m)}
                />
                {METHOD_NAMES[m]}
              </label>
            ))}
          </div>
          <p className="text-xs text-text-tertiary">
            Diminishing value claims more in the first years; prime cost the same each year. Once a
            lodged year includes the asset, its method can&rsquo;t change.
          </p>
          {preview && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-md bg-surface-alt p-3">
              <ScheduleTable
                rows={preview.diminishing_value.slice(0, 5)}
                caption="Diminishing value"
              />
              <ScheduleTable rows={preview.prime_cost.slice(0, 5)} caption="Prime cost" />
            </div>
          )}
        </fieldset>

        <div className={field}>
          <label htmlFor="asset-notes" className="block">
            Notes
          </label>
          <Input
            id="asset-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={5000}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || !name.trim() || save.isPending}>
            {asset ? 'Save' : prefill?.claimed ? 'Depreciate instead' : 'Add asset'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = useAssetMutation(({ fy, bps }: { fy: number; bps: number | null }) =>
    setYearWorkUse(asset.id, fy, bps),
  );
  const undo = useAssetMutation(() => undisposeAsset(asset.id));
  const remove = useAssetMutation(() => deleteAsset(asset.id));
  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work');
    }
  };
  const fileCount = asset.files.length;

  return (
    <>
      <Modal isOpen onClose={onClose} title={asset.name} size="lg">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ['Label', `${asset.label}`],
              ['Method', METHOD_NAMES[asset.method]],
              ['Cost', formatCurrency(asset.cost)],
              ['Start date', formatDay(asset.startDate)],
              ['Effective life', `${asset.effectiveLifeHundredths / 100} years`],
              ['Work use', pct(asset.workUseBps)],
              ...(asset.disposedDate
                ? [
                    ['Disposed', formatDay(asset.disposedDate)],
                    ['Termination value', formatCurrency(asset.terminationValue ?? 0)],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-tertiary">{k}</dt>
                <dd className="text-text">{v}</dd>
              </div>
            ))}
          </dl>
          {asset.lodgedYears.length > 0 && (
            <p className="text-xs text-text-tertiary">
              <Lock size={11} className="inline" /> In lodged{' '}
              {asset.lodgedYears.map(fyName).join(', ')}: its figures for those years can&rsquo;t
              change until the year is unlocked.
            </p>
          )}

          <section aria-label="Schedule" className="overflow-x-auto">
            <table className="w-full text-sm min-w-[36rem]">
              <thead>
                <tr className="text-left text-xs text-text-tertiary">
                  <th className="py-1 font-medium">Year</th>
                  <th className="text-right font-medium">Opening</th>
                  <th className="text-right font-medium">Decline</th>
                  <th className="text-right font-medium">Work use</th>
                  <th className="text-right font-medium">Deduction</th>
                  <th className="text-right font-medium">Closing</th>
                </tr>
              </thead>
              <tbody>
                {asset.schedule.map((r) => {
                  const own = asset.yearWorkUse[r.financialYear];
                  const locked = asset.lodgedYears.includes(r.financialYear);
                  return (
                    <tr key={r.financialYear} className="border-t border-border-light">
                      <td className="py-1.5">{fyName(r.financialYear)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(r.opening)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(r.decline)}</td>
                      <td className="text-right">
                        <WorkUseCell
                          bps={r.workUseBps}
                          own={own !== undefined}
                          disabled={locked || year.isPending}
                          label={`Work use in ${fyName(r.financialYear)}`}
                          onSave={(bps) => run(year.mutateAsync({ fy: r.financialYear, bps }))}
                        />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatCurrency(r.deduction)}
                        {r.balancingAdjustment !== undefined && (
                          <span className="block text-xs text-text-tertiary">
                            Balancing adjustment {formatCurrency(r.balancingAdjustment)}
                            {(r.balancingTaxable ?? 0) > 0 ? ' (income)' : ''}
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{formatCurrency(r.closing)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <PoolChoice
            asset={asset}
            onError={(err) => setError(err instanceof Error ? err.message : 'That didn’t work')}
          />
          <FilesSection kind="asset" targetId={asset.id} title="Records" />
          {asset.receipts.length > 0 && (
            <p className="text-xs text-text-tertiary">
              The purchase&rsquo;s receipts count too:{' '}
              {asset.receipts.map((r) => r.fileName).join(', ')}.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(true)}>
              Remove
            </Button>
            {asset.disposedDate ? (
              <Button variant="secondary" onClick={() => run(undo.mutateAsync(undefined))}>
                Undo disposal
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setDisposing(true)}>
                Sold or no longer used…
              </Button>
            )}
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </div>
        </div>
      </Modal>
      {editing && (
        <AssetForm
          prefill={null}
          asset={asset}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
      {disposing && <DisposeForm asset={asset} onClose={() => setDisposing(false)} />}
      <ConfirmModal
        isOpen={removing}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          void run(remove.mutateAsync(undefined).then(onClose));
        }}
        title={`Remove ${asset.name}?`}
        message={`Its decline in value leaves Tax time.${
          fileCount
            ? ` Its ${fileCount} file${fileCount === 1 ? '' : 's'} stay${fileCount === 1 ? 's' : ''} in Files: keep records for five years after the last claim.`
            : ''
        }`}
        confirmLabel="Remove"
        danger
      />
    </>
  );
}

/** A year's own work-use share: blank goes back to the asset's */
function WorkUseCell({
  bps,
  own,
  disabled,
  label,
  onSave,
}: {
  bps: number;
  own: boolean;
  disabled: boolean;
  label: string;
  onSave: (bps: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(own ? String(bps / 100) : '');
  useEffect(() => setValue(own ? String(bps / 100) : ''), [own, bps]);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="w-20 text-right ml-auto"
      placeholder={pct(bps)}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim() === '' ? null : Math.round(Number(value) * 100);
        if (next !== null && (!Number.isFinite(next) || next < 0 || next > 10_000)) return;
        if ((next === null && !own) || (own && next === bps)) return;
        void onSave(next);
      }}
    />
  );
}

function DisposeForm({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dispose = useAssetMutation(() => disposeAsset(asset.id, date, value));
  return (
    <Modal isOpen onClose={onClose} title={`Sold or no longer used: ${asset.name}`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await dispose.mutateAsync(undefined);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save');
          }
        }}
      >
        <p className="text-sm text-text-secondary">
          Sold, lost, destroyed, or never to be used again. What it brought in (sale price or
          insurance payout) less its value on that day is a balancing adjustment: a shortfall is a
          deduction, an excess is income. Any capital gain on a private-use share is outside what
          Allotment works out.
        </p>
        <div className="block text-xs font-medium text-text-secondary space-y-1">
          <label htmlFor="dispose-date" className="block">
            Date
          </label>
          <Input
            id="dispose-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="block text-xs font-medium text-text-secondary space-y-1">
          <span className="block">What it brought in (0 if nothing)</span>
          <CurrencyInput value={value} onChange={setValue} aria-label="Termination value" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={dispose.isPending}>
            Record disposal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

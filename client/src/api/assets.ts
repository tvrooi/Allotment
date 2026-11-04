import { API_BASE } from './base';
import { apiFetch } from './client';

// Depreciating assets on Tax time (server: routes/tax.ts, services/depreciatingAssetService.ts;
// docs/DEPRECIATING-ASSETS-PLAN.md). Amounts are cents; financial years are numbered by the year
// they start (2026 = 2026–27).

export type AssetMethod = 'prime_cost' | 'diminishing_value';
export const ASSET_LABELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D15'] as const;
export type AssetLabel = (typeof ASSET_LABELS)[number];

export interface ScheduleRow {
  financialYear: number;
  daysHeld: number;
  opening: number;
  baseValue: number;
  decline: number;
  workUseBps: number;
  deduction: number;
  closing: number;
  balancingAdjustment?: number;
  balancingTaxable?: number;
}

export interface Asset {
  id: string;
  name: string;
  notes: string | null;
  label: AssetLabel;
  method: AssetMethod;
  cost: number;
  startDate: string;
  purchaseDate: string | null;
  effectiveLifeHundredths: number;
  workUseBps: number;
  partOfSet: boolean;
  transactionId: string | null;
  openingFy: number | null;
  openingAdjustableValue: number | null;
  disposedDate: string | null;
  terminationValue: number | null;
  /** In the low-value pool (D6) from this financial year: its own schedule stops before it */
  pooledFy: number | null;
  /** Years it could join the pool, and what it would add (its taxable share) */
  poolOptions: { financialYear: number; kind: PoolKind; amount: number }[];
  yearWorkUse: Record<number, number>;
  schedule: ScheduleRow[];
  /** Lodged years this asset's figures appear in: they can't change until unlocked */
  lodgedYears: number[];
  receipts: { id: string; fileName: string }[];
  files: { id: string; fileName: string }[];
}

export interface AssetInput {
  name?: string;
  notes?: string | null;
  label?: AssetLabel;
  method?: AssetMethod;
  cost?: number;
  startDate?: string;
  purchaseDate?: string | null;
  effectiveLifeHundredths?: number;
  workUseBps?: number;
  partOfSet?: boolean;
  transactionId?: string | null;
  replaceClaim?: boolean;
  openingFy?: number | null;
  openingAdjustableValue?: number | null;
}

export type PoolKind = 'low_cost' | 'low_value';

export interface PoolRow {
  financialYear: number;
  opening: number;
  lowCostAdded: number;
  lowValueAdded: number;
  /** The D6 deduction */
  decline: number;
  terminations: number;
  closing: number;
  /** Termination values beyond the balance: assessable income */
  income: number;
}

export interface Preview {
  prime_cost: ScheduleRow[];
  diminishing_value: ScheduleRow[];
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const listAssets = () => apiFetch<Asset[]>('/tax/assets');
export const getAsset = (id: string) => apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}`);
export const previewAsset = (input: {
  cost: number;
  startDate: string;
  effectiveLifeHundredths: number;
  workUseBps: number;
}) => apiFetch<Preview>('/tax/assets/preview', { method: 'POST', ...json(input) });
export const createAsset = (input: AssetInput) =>
  apiFetch<Asset>('/tax/assets', { method: 'POST', ...json(input) });
export const updateAsset = (id: string, input: AssetInput) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}`, { method: 'PUT', ...json(input) });
export const deleteAsset = (id: string) =>
  apiFetch<void>(`/tax/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const setYearWorkUse = (id: string, fy: number, workUseBps: number | null) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}/years/${fy}`, {
    method: 'PUT',
    ...json({ workUseBps }),
  });
export const disposeAsset = (id: string, date: string, terminationValue: number) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}/dispose`, {
    method: 'POST',
    ...json({ date, terminationValue }),
  });
export const undisposeAsset = (id: string) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}/dispose`, { method: 'DELETE' });
export const poolAsset = (id: string, financialYear: number) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}/pool`, {
    method: 'PUT',
    ...json({ financialYear }),
  });
export const unpoolAsset = (id: string) =>
  apiFetch<Asset>(`/tax/assets/${encodeURIComponent(id)}/pool`, { method: 'DELETE' });
export const poolRows = () => apiFetch<PoolRow[]>('/tax/pool');
export const lodgedYears = () => apiFetch<number[]>('/tax/lodged');
export const lodgeYear = (fy: number) => apiFetch<number[]>(`/tax/lodged/${fy}`, { method: 'PUT' });
export const unlodgeYear = (fy: number) =>
  apiFetch<number[]>(`/tax/lodged/${fy}`, { method: 'DELETE' });
export const assetScheduleCsvUrl = (fy: number) => `${API_BASE}/tax/years/${fy}/assets/csv`;

/**
 * Suggested effective lives (owner decision 4): a short list from the ATO's effective life
 * table, checked 4 November 2026. The ATO revises them, so each links to its tool, and the owner
 * can always type their own.
 */
export const ATO_EFFECTIVE_LIFE_URL =
  'https://www.ato.gov.au/calculators-and-tools/tax-return-item-calculators/effective-life-of-depreciating-assets';
export const SUGGESTED_LIVES: { item: string; years: number }[] = [
  { item: 'Laptop', years: 2 },
  { item: 'Tablet', years: 2 },
  { item: 'Mobile phone', years: 3 },
  { item: 'Desktop computer', years: 4 },
];
export const LIVES_CHECKED = '4 November 2026';

export const fyName = (fy: number) => `${fy}–${String(fy + 1).slice(2)}`;
export const fyOf = (date: string) => {
  const year = Number(date.slice(0, 4));
  return date.slice(5) >= '07-01' ? year : year - 1;
};

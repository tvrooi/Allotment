// Behind a white initial, so each is at least 4.5:1 against white (transactionColors.test.ts)
export const PAYEE_COLORS = [
  '#4F46E5',
  '#DB2777',
  '#B45309',
  '#047857',
  '#2563EB',
  '#7C3AED',
  '#DC2626',
  '#0F766E',
  '#C2410C',
  '#0E7490',
];

export function payeeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PAYEE_COLORS[Math.abs(hash) % PAYEE_COLORS.length];
}

export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking: '#3B82F6',
  savings: '#10B981',
  cash: '#6B7280',
  credit: '#F59E0B',
  line_of_credit: '#D97706',
  investment: '#8B5CF6',
  retirement: '#6366F1',
  crypto: '#14B8A6',
  real_estate: '#0891B2',
  vehicle: '#475569',
  valuables: '#DB2777',
  mortgage: '#DC2626',
  auto_loan: '#EA580C',
  student_loan: '#E11D48',
  loan: '#B91C1C',
  other_asset: '#78716C',
  other_liability: '#9F1239',
};

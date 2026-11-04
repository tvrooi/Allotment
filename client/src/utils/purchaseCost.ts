// Depreciating assets (docs/DEPRECIATING-ASSETS-PLAN.md): an asset's cost from its purchase

/**
 * A purchase's cost in the budget's currency, as an asset's cost is: a purchase in an account in
 * another currency uses its value in the budget's, and has none (null) while that has no rate yet
 */
export function purchaseCost(tx: {
  amount: number;
  mainAmount?: number | null;
  mainAmountSource?: string | null;
}): number | null {
  if (tx.mainAmountSource === 'missing') return null;
  return -(tx.mainAmountSource ? (tx.mainAmount ?? tx.amount) : tx.amount);
}

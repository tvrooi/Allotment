-- The day a person typed "current balance" when adding an account. Imports of older history
-- into it keep that balance true by moving the starting balance (never for bank-linked
-- accounts or accounts with reconciled rows). Cleared when the starting balance is edited.
ALTER TABLE accounts ADD COLUMN balance_as_of TEXT;

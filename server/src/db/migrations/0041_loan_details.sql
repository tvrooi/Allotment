CREATE TABLE account_loan_details (
	account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
	monthly_repayment INTEGER NOT NULL DEFAULT 0 CHECK (monthly_repayment >= 0),
	term_months INTEGER CHECK (term_months IS NULL OR term_months >= 1),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

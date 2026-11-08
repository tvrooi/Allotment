-- D3c splits and consolidations (docs/INVESTMENT-SALES-AND-INCOME.md §4 and §5.1). Additive: a
-- split is an event on a holding (a date and a ratio). No lot or sale parcel is rewritten; a lot's
-- units on a day are its recorded units times the splits after it was acquired and on or before
-- that day, and the holding's units are scaled when the split is recorded.
CREATE TABLE investment_splits (
	id TEXT PRIMARY KEY NOT NULL,
	holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
	effective_on TEXT NOT NULL,
	to_units INTEGER NOT NULL CHECK (to_units > 0),
	from_units INTEGER NOT NULL CHECK (from_units > 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX investment_splits_holding_idx ON investment_splits (holding_id);

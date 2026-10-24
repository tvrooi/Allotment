CREATE TABLE long_term_plans (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
	settings_json TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX long_term_plans_name_idx ON long_term_plans (name COLLATE NOCASE);
--> statement-breakpoint
CREATE TABLE long_term_events (
	plan_id TEXT NOT NULL REFERENCES long_term_plans(id) ON DELETE CASCADE,
	id TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('home', 'newJob', 'careerBreak', 'child', 'oneOff', 'recurring', 'retirement', 'payOff')),
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
	position INTEGER NOT NULL CHECK (position >= 0),
	enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
	params_json TEXT NOT NULL,
	PRIMARY KEY (plan_id, id)
);
--> statement-breakpoint
CREATE TABLE long_term_account_assumptions (
	plan_id TEXT NOT NULL REFERENCES long_term_plans(id) ON DELETE CASCADE,
	account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	included INTEGER NOT NULL DEFAULT 1 CHECK (included IN (0, 1)),
	cls TEXT CHECK (cls IS NULL OR cls IN ('cash', 'investments', 'super', 'property', 'vehicles', 'other')),
	growth_bps INTEGER CHECK (growth_bps IS NULL OR growth_bps BETWEEN -5000 AND 1500),
	PRIMARY KEY (plan_id, account_id)
);
--> statement-breakpoint
CREATE TABLE long_term_splits (
	plan_id TEXT NOT NULL REFERENCES long_term_plans(id) ON DELETE CASCADE,
	position INTEGER NOT NULL CHECK (position >= 0),
	account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	mode TEXT NOT NULL CHECK (mode IN ('percent', 'fixed')),
	bps INTEGER CHECK (bps IS NULL OR bps BETWEEN 0 AND 10000),
	amount INTEGER CHECK (amount IS NULL OR amount >= 0),
	PRIMARY KEY (plan_id, position)
);

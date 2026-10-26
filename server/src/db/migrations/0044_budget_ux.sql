ALTER TABLE categories ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE budget_proposals (
	id TEXT PRIMARY KEY NOT NULL,
	month TEXT NOT NULL,
	token_id TEXT,
	token_name TEXT NOT NULL,
	note TEXT,
	rows_json TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'dismissed')),
	created_at TEXT NOT NULL,
	decided_at TEXT
);

ALTER TABLE payees ADD COLUMN skip_category_followup INTEGER NOT NULL DEFAULT 0 CHECK (skip_category_followup IN (0, 1));
--> statement-breakpoint
ALTER TABLE schedules ADD COLUMN confirmed_active_at TEXT;
--> statement-breakpoint
CREATE TABLE forecast_scenarios (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
	assumptions TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	version INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX forecast_scenarios_name_nocase_idx ON forecast_scenarios (name COLLATE NOCASE);

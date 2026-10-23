ALTER TABLE transactions ADD COLUMN reviewed_at TEXT;
--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN hidden_from_reports INTEGER NOT NULL DEFAULT 0 CHECK (hidden_from_reports IN (0, 1));
--> statement-breakpoint
CREATE TABLE tags (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
	color TEXT NOT NULL DEFAULT '#6366f1',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX tags_name_nocase_idx ON tags (name COLLATE NOCASE);
--> statement-breakpoint
CREATE TABLE transaction_tags (
	transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
	tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
	PRIMARY KEY (transaction_id, tag_id)
);
--> statement-breakpoint
CREATE INDEX transaction_tags_tag_idx ON transaction_tags (tag_id);
--> statement-breakpoint
CREATE TABLE saved_views (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
	query TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE receipt_files (
	id TEXT PRIMARY KEY NOT NULL,
	mime_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	data BLOB NOT NULL,
	created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE receipts (
	id TEXT PRIMARY KEY NOT NULL,
	transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
	file_id TEXT NOT NULL,
	file_name TEXT NOT NULL,
	mime_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	merchant TEXT,
	receipt_date TEXT,
	total INTEGER,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX receipts_transaction_idx ON receipts (transaction_id);
--> statement-breakpoint
CREATE TABLE tax_claims (
	transaction_id TEXT PRIMARY KEY NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
	label TEXT NOT NULL,
	work_use_bps INTEGER DEFAULT 10000 NOT NULL,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

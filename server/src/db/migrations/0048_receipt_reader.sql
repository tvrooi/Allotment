ALTER TABLE receipts ADD COLUMN read_status TEXT;
--> statement-breakpoint
ALTER TABLE receipts ADD COLUMN read_error TEXT;
--> statement-breakpoint
ALTER TABLE receipts ADD COLUMN read_at TEXT;
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_reader_enabled INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_reader_url TEXT;
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_reader_model TEXT;

ALTER TABLE receipts ADD COLUMN subtotal INTEGER;
--> statement-breakpoint
ALTER TABLE receipts ADD COLUMN tax INTEGER;
--> statement-breakpoint
ALTER TABLE receipts ADD COLUMN tip INTEGER;
--> statement-breakpoint
ALTER TABLE receipts ADD COLUMN matched_by TEXT;
--> statement-breakpoint
UPDATE receipts SET matched_by = 'manual' WHERE transaction_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE receipt_line_items (
	id TEXT PRIMARY KEY NOT NULL,
	receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	description TEXT NOT NULL,
	amount INTEGER NOT NULL,
	category_id TEXT REFERENCES categories(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX receipt_line_items_receipt_idx ON receipt_line_items (receipt_id);
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_auto_split INTEGER DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_add_notes INTEGER DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE budget_settings ADD COLUMN receipt_add_tag INTEGER DEFAULT 1 NOT NULL;

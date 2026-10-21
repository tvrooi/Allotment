ALTER TABLE up_account_mappings ADD COLUMN settled_balance INTEGER;
--> statement-breakpoint
ALTER TABLE up_account_mappings ADD COLUMN round_up_debits_at TEXT;

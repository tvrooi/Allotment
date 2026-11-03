-- Linking Up to an account that already has history: Up rows before the cut-over are never
-- imported. The difference is the bank's balance at the cut-over minus the register's, kept so
-- the owner can see it; nothing is adjusted. overlap_transaction_id points a flagged Up import
-- at the older row it may duplicate; nothing is merged.
ALTER TABLE up_account_mappings ADD COLUMN cutover_date TEXT;
--> statement-breakpoint
ALTER TABLE up_account_mappings ADD COLUMN cutover_difference INTEGER;
--> statement-breakpoint
ALTER TABLE up_source_records ADD COLUMN overlap_transaction_id TEXT;

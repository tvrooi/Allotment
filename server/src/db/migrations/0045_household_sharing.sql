CREATE TABLE household_pool_accounts (
	group_id TEXT NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE,
	account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
	PRIMARY KEY (group_id, account_id)
);
--> statement-breakpoint
ALTER TABLE household_groups ADD COLUMN default_split_json TEXT;

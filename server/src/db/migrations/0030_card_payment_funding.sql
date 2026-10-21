CREATE TABLE card_funding (account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, category_id TEXT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT, start_date TEXT NOT NULL, baseline_ids TEXT NOT NULL, reviewed_balance INTEGER NOT NULL, initial_funding INTEGER NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER funding_card_funding_insert AFTER INSERT ON card_funding BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_card_funding_update AFTER UPDATE ON card_funding BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_card_funding_delete AFTER DELETE ON card_funding BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER card_payment_transactions_insert BEFORE INSERT ON transactions WHEN EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Card payment categories hold funding; record repayments as transfers'); END;
--> statement-breakpoint
CREATE TRIGGER card_payment_transactions_update BEFORE UPDATE ON transactions WHEN EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Card payment categories hold funding; record repayments as transfers'); END;
--> statement-breakpoint
CREATE TRIGGER card_payment_category_group BEFORE UPDATE OF group_id ON categories WHEN old.group_id != new.group_id AND EXISTS (SELECT 1 FROM card_funding WHERE category_id = old.id) BEGIN SELECT RAISE(ABORT, 'Card payment categories must remain in their expense group'); END;
--> statement-breakpoint
CREATE TRIGGER card_payment_income_group BEFORE UPDATE OF is_income ON category_groups WHEN new.is_income = 1 AND EXISTS (SELECT 1 FROM card_funding cf JOIN categories c ON c.id = cf.category_id WHERE c.group_id = old.id) BEGIN SELECT RAISE(ABORT, 'Card payment categories cannot become income'); END;
--> statement-breakpoint
CREATE TRIGGER card_funding_account_scope BEFORE UPDATE OF type, is_off_budget ON accounts WHEN (new.is_off_budget != 0 OR new.type NOT IN ('credit', 'line_of_credit')) AND EXISTS (SELECT 1 FROM card_funding WHERE account_id = old.id) BEGIN SELECT RAISE(ABORT, 'An account with payment funding must remain an on-budget credit account'); END;
--> statement-breakpoint
CREATE TRIGGER card_funding_household_insert BEFORE INSERT ON household_groups WHEN EXISTS (SELECT 1 FROM card_funding WHERE account_id = new.account_id) BEGIN SELECT RAISE(ABORT, 'Card payment funding accounts cannot become household pools'); END;
--> statement-breakpoint
CREATE TRIGGER card_funding_household_update BEFORE UPDATE ON household_groups WHEN EXISTS (SELECT 1 FROM card_funding WHERE account_id = new.account_id) BEGIN SELECT RAISE(ABORT, 'Card payment funding accounts cannot become household pools'); END;
--> statement-breakpoint
CREATE TRIGGER card_funding_valid_setup BEFORE INSERT ON card_funding WHEN NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = new.account_id AND a.is_off_budget = 0 AND a.type IN ('credit', 'line_of_credit') AND NOT EXISTS (SELECT 1 FROM household_groups hg WHERE hg.account_id = a.id)) OR NOT EXISTS (SELECT 1 FROM categories c JOIN category_groups g ON g.id = c.group_id WHERE c.id = new.category_id AND g.is_income = 0) BEGIN SELECT RAISE(ABORT, 'Invalid card payment account or category'); END;
--> statement-breakpoint
CREATE TRIGGER card_funding_currency BEFORE UPDATE OF currency ON accounts WHEN old.currency IS NOT new.currency AND EXISTS (SELECT 1 FROM card_funding WHERE account_id = old.id) BEGIN SELECT RAISE(ABORT, 'A card with payment funding must keep its currency'); END;

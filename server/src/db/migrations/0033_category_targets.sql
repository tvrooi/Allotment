CREATE TABLE category_targets (
	category_id TEXT PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	type TEXT NOT NULL CHECK (type IN ('monthly', 'by-date', 'recurring', 'refill')),
	amount INTEGER NOT NULL CHECK (amount > 0),
	due_date TEXT,
	cycle_months INTEGER CHECK (cycle_months IS NULL OR cycle_months BETWEEN 1 AND 60),
	created_month TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TRIGGER target_category_valid_insert BEFORE INSERT ON category_targets WHEN NOT EXISTS (SELECT 1 FROM categories c JOIN category_groups g ON g.id = c.group_id WHERE c.id = new.category_id AND g.is_income = 0) OR EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Targets require an expense category outside card payment reserves'); END;
--> statement-breakpoint
CREATE TRIGGER target_category_group BEFORE UPDATE OF group_id ON categories WHEN EXISTS (SELECT 1 FROM category_targets WHERE category_id = old.id) AND EXISTS (SELECT 1 FROM category_groups WHERE id = new.group_id AND is_income = 1) BEGIN SELECT RAISE(ABORT, 'Target categories must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER target_income_group BEFORE UPDATE OF is_income ON category_groups WHEN new.is_income = 1 AND EXISTS (SELECT 1 FROM category_targets t JOIN categories c ON c.id = t.category_id WHERE c.group_id = old.id) BEGIN SELECT RAISE(ABORT, 'Target categories must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER target_card_funding BEFORE INSERT ON card_funding WHEN EXISTS (SELECT 1 FROM category_targets WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Target categories cannot become card payment reserves'); END;

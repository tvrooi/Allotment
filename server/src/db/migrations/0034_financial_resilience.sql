CREATE TABLE financial_priorities (
	id TEXT PRIMARY KEY NOT NULL,
	purpose TEXT,
	essential_monthly_amount INTEGER CHECK (essential_monthly_amount IS NULL OR essential_monthly_amount > 0),
	reserve_target_type TEXT CHECK (reserve_target_type IS NULL OR reserve_target_type IN ('amount', 'months')),
	reserve_target_amount INTEGER CHECK (reserve_target_amount IS NULL OR reserve_target_amount > 0),
	reserve_target_months INTEGER CHECK (reserve_target_months IS NULL OR reserve_target_months BETWEEN 1 AND 60),
	reserve_minimum INTEGER CHECK (reserve_minimum IS NULL OR reserve_minimum > 0),
	review_cadence TEXT NOT NULL DEFAULT 'off' CHECK (review_cadence IN ('payday', 'monthly', 'quarterly', 'off')),
	reminder_snoozed_until TEXT,
	revision INTEGER NOT NULL DEFAULT 1,
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	CHECK ((reserve_target_type IS NULL AND reserve_target_amount IS NULL AND reserve_target_months IS NULL)
		OR (reserve_target_type = 'amount' AND reserve_target_amount IS NOT NULL AND reserve_target_months IS NULL)
		OR (reserve_target_type = 'months' AND reserve_target_months IS NOT NULL AND reserve_target_amount IS NULL))
);
--> statement-breakpoint
CREATE TABLE category_purposes (
	category_id TEXT PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	purpose TEXT NOT NULL CHECK (purpose IN ('essential', 'enjoyment', 'flexibility'))
);
--> statement-breakpoint
CREATE TRIGGER purpose_category_valid_insert BEFORE INSERT ON category_purposes WHEN NOT EXISTS (SELECT 1 FROM categories c JOIN category_groups g ON g.id = c.group_id WHERE c.id = new.category_id AND g.is_income = 0) OR EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Purposes require an expense category outside card payment reserves'); END;
--> statement-breakpoint
CREATE TRIGGER purpose_category_group BEFORE UPDATE OF group_id ON categories WHEN EXISTS (SELECT 1 FROM category_purposes WHERE category_id = old.id) AND EXISTS (SELECT 1 FROM category_groups WHERE id = new.group_id AND is_income = 1) BEGIN SELECT RAISE(ABORT, 'Categories with a purpose must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER purpose_income_group BEFORE UPDATE OF is_income ON category_groups WHEN new.is_income = 1 AND EXISTS (SELECT 1 FROM category_purposes p JOIN categories c ON c.id = p.category_id WHERE c.group_id = old.id) BEGIN SELECT RAISE(ABORT, 'Categories with a purpose must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER purpose_card_funding BEFORE INSERT ON card_funding WHEN EXISTS (SELECT 1 FROM category_purposes WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Categories with a purpose cannot become card payment reserves'); END;
--> statement-breakpoint
ALTER TABLE goals ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'retired'));
--> statement-breakpoint
ALTER TABLE goals ADD COLUMN status_reason TEXT;
--> statement-breakpoint
ALTER TABLE goals ADD COLUMN replaced_by_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE goals ADD COLUMN status_changed_at TEXT;
--> statement-breakpoint
CREATE TRIGGER funding_goals_status AFTER UPDATE OF status, category_id ON goals BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TABLE goal_status_events (
	id TEXT PRIMARY KEY NOT NULL,
	goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
	from_status TEXT NOT NULL CHECK (from_status IN ('active', 'paused', 'completed', 'retired')),
	to_status TEXT NOT NULL CHECK (to_status IN ('active', 'paused', 'completed', 'retired')),
	reason TEXT,
	replacement_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
	move_id TEXT REFERENCES budget_moves(id) ON DELETE SET NULL,
	created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX goal_status_events_goal ON goal_status_events(goal_id, created_at);
--> statement-breakpoint
CREATE TABLE review_completions (
	id TEXT PRIMARY KEY NOT NULL,
	completed_at TEXT NOT NULL,
	as_of TEXT NOT NULL,
	snapshot_json TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE income_reviews (
	id TEXT PRIMARY KEY NOT NULL,
	transaction_id TEXT NOT NULL UNIQUE,
	month TEXT NOT NULL,
	category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
	received INTEGER NOT NULL,
	baseline INTEGER NOT NULL CHECK (baseline >= 0),
	reserve_percent INTEGER NOT NULL CHECK (reserve_percent BETWEEN 0 AND 100),
	assigned INTEGER NOT NULL CHECK (assigned >= 0),
	created_at TEXT NOT NULL
);

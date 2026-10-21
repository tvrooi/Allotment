ALTER TABLE goals ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX goals_category_id_unique ON goals(category_id);
--> statement-breakpoint
CREATE TRIGGER goal_category_valid_insert BEFORE INSERT ON goals WHEN new.category_id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM categories c JOIN category_groups g ON g.id = c.group_id WHERE c.id = new.category_id AND g.is_income = 0) OR EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id)) BEGIN SELECT RAISE(ABORT, 'Goals require an expense category outside card payment reserves'); END;
--> statement-breakpoint
CREATE TRIGGER goal_category_valid_update BEFORE UPDATE OF category_id ON goals WHEN new.category_id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM categories c JOIN category_groups g ON g.id = c.group_id WHERE c.id = new.category_id AND g.is_income = 0) OR EXISTS (SELECT 1 FROM card_funding WHERE category_id = new.category_id)) BEGIN SELECT RAISE(ABORT, 'Goals require an expense category outside card payment reserves'); END;
--> statement-breakpoint
CREATE TRIGGER goal_category_group BEFORE UPDATE OF group_id ON categories WHEN EXISTS (SELECT 1 FROM goals WHERE category_id = old.id) AND EXISTS (SELECT 1 FROM category_groups WHERE id = new.group_id AND is_income = 1) BEGIN SELECT RAISE(ABORT, 'Goal categories must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER goal_income_group BEFORE UPDATE OF is_income ON category_groups WHEN new.is_income = 1 AND EXISTS (SELECT 1 FROM goals g JOIN categories c ON c.id = g.category_id WHERE c.group_id = old.id) BEGIN SELECT RAISE(ABORT, 'Goal categories must remain expenses'); END;
--> statement-breakpoint
CREATE TRIGGER goal_card_funding BEFORE INSERT ON card_funding WHEN EXISTS (SELECT 1 FROM goals WHERE category_id = new.category_id) BEGIN SELECT RAISE(ABORT, 'Goal categories cannot become card payment reserves'); END;

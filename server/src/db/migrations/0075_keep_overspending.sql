-- ACT-04: a category can keep its overspending into the next month (reimbursable spending)
-- instead of resetting to zero. Additive: existing categories keep resetting.
ALTER TABLE `categories` ADD `keep_overspending` integer DEFAULT 0 NOT NULL;

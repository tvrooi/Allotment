-- ACT-03: money held in a month for the next. One row per month with a hold; the amount is
-- minor units of the budget's currency. Additive: no existing row changes.
CREATE TABLE `budget_holds` (
	`month` text PRIMARY KEY NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
-- The ledger is cached by budget_revision (docs/ENVELOPE-FUNDING.md, "One pass, cached"), so a
-- change to a hold must bump it like a change to an assignment.
CREATE TRIGGER funding_budget_holds_insert AFTER INSERT ON budget_holds BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_budget_holds_update AFTER UPDATE ON budget_holds BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_budget_holds_delete AFTER DELETE ON budget_holds BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;

-- Undoing a payday funding keeps a record of it ("Undone on ...") in Funding history. The applied
-- event itself is removed so the payday can be previewed and applied again; this row keeps its
-- snapshot, what the undo reversed, and what it could not because the assignment had changed since.
CREATE TABLE `payday_funding_undos` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `scheduled_date` text NOT NULL,
  `applied_date` text NOT NULL,
  `snapshot_json` text NOT NULL,
  `result_json` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `undone_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payday_undo_plan` ON `payday_funding_undos` (`plan_id`);

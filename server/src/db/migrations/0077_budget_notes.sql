-- BUD-10: notes on the budget. One note per month and one per category, free text written by the
-- owner. Additive: no existing row changes. Neither table has a budget_revision trigger, because
-- a note moves no money and must not make an open funding preview stale.
CREATE TABLE `budget_month_notes` (
	`month` text PRIMARY KEY NOT NULL,
	`note` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_notes` (
	`category_id` text PRIMARY KEY NOT NULL REFERENCES `categories`(`id`) ON DELETE cascade,
	`note` text NOT NULL,
	`updated_at` text NOT NULL
);

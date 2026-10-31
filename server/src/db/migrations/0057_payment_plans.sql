-- Buy now, pay later (docs/PAYMENT-PLANS.md): a purchase on an Afterpay-style credit account,
-- paid off in a fixed number of instalments from a bank account. The purchase is an ordinary
-- transaction with its real category; each instalment, once paid, links to the Afterpay side
-- of a transfer. Nothing here changes a balance by itself.
CREATE TABLE `payment_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  `funding_account_id` text REFERENCES `accounts`(`id`) ON DELETE SET NULL,
  `purchase_transaction_id` text REFERENCES `transactions`(`id`) ON DELETE SET NULL,
  `provider` text DEFAULT 'afterpay' NOT NULL,
  `merchant` text NOT NULL,
  `total` integer NOT NULL,
  `instalment_count` integer NOT NULL,
  `frequency` text DEFAULT 'fortnightly' NOT NULL,
  `first_due_date` text NOT NULL,
  `extra_transaction_ids` text DEFAULT '[]' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_plans_account` ON `payment_plans` (`account_id`);
--> statement-breakpoint
CREATE TABLE `payment_plan_instalments` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL REFERENCES `payment_plans`(`id`) ON DELETE CASCADE,
  `seq` integer NOT NULL,
  `due_date` text NOT NULL,
  `amount` integer NOT NULL,
  `transaction_id` text REFERENCES `transactions`(`id`) ON DELETE SET NULL,
  `previous_json` text,
  `paid_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_plan_instalments_seq` ON `payment_plan_instalments` (`plan_id`,`seq`);
--> statement-breakpoint
CREATE INDEX `payment_plan_instalments_tx` ON `payment_plan_instalments` (`transaction_id`);
--> statement-breakpoint
CREATE TABLE `payment_plan_dismissals` (
  `instalment_id` text NOT NULL REFERENCES `payment_plan_instalments`(`id`) ON DELETE CASCADE,
  `transaction_id` text NOT NULL REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  PRIMARY KEY(`instalment_id`, `transaction_id`)
);

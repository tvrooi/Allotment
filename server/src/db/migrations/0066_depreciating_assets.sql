-- Depreciating assets on Tax time, phase 1 (docs/DEPRECIATING-ASSETS-PLAN.md §3.1). Additive.
CREATE TABLE `depreciating_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`label` text NOT NULL CHECK (`label` IN ('D1','D2','D3','D4','D5','D15')),
	`method` text NOT NULL CHECK (`method` IN ('prime_cost','diminishing_value')),
	`cost` integer NOT NULL CHECK (`cost` > 0),
	`start_date` text NOT NULL CHECK (`start_date` >= '2006-05-10'),
	`purchase_date` text,
	`effective_life_hundredths` integer NOT NULL CHECK (`effective_life_hundredths` > 0),
	`work_use_bps` integer NOT NULL CHECK (`work_use_bps` BETWEEN 1 AND 10000),
	`part_of_set` integer DEFAULT 0 NOT NULL,
	`transaction_id` text REFERENCES `transactions`(`id`) ON DELETE SET NULL,
	`opening_fy` integer,
	`opening_adjustable_value` integer CHECK (`opening_adjustable_value` IS NULL OR `opening_adjustable_value` >= 0),
	`disposed_date` text,
	`termination_value` integer CHECK (`termination_value` IS NULL OR `termination_value` >= 0),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `depreciating_assets_transaction_idx` ON `depreciating_assets` (`transaction_id`) WHERE transaction_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `depreciating_asset_years` (
	`asset_id` text NOT NULL REFERENCES `depreciating_assets`(`id`) ON DELETE CASCADE,
	`financial_year` integer NOT NULL,
	`work_use_bps` integer NOT NULL CHECK (`work_use_bps` BETWEEN 0 AND 10000),
	PRIMARY KEY (`asset_id`, `financial_year`)
);
--> statement-breakpoint
CREATE TABLE `tax_lodged_years` (
	`financial_year` integer PRIMARY KEY NOT NULL,
	`lodged_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `document_links` ADD `asset_id` text REFERENCES `depreciating_assets`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
CREATE UNIQUE INDEX `document_links_asset_idx` ON `document_links` (`asset_id`,`document_id`) WHERE asset_id IS NOT NULL;

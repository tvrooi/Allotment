-- Dedicated assistant endpoints (audit decision I-11, docs/ASSISTANT-ENDPOINTS.md): every write an
-- access token asks for, allowed or refused, one row each. A security log, kept to the newest rows
-- and never in backups. Additive.
CREATE TABLE `assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`token_id` text,
	`token_name` text NOT NULL,
	`scope` text NOT NULL,
	`action` text,
	`tool` text,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`outcome` text NOT NULL,
	`status` integer,
	`reason` text
);
--> statement-breakpoint
CREATE INDEX `assistant_actions_created_idx` ON `assistant_actions` (`created_at`);

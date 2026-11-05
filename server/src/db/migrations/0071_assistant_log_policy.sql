-- Audit decision I-11, merging PR #140 into what up.99 shipped (docs/ASSISTANT-ENDPOINTS.md): the
-- assistant log records the token's scope, the MCP tool, the outcome and its reason, and keeps no
-- request bodies, so the bodies up.99 kept are cleared. Additive otherwise.
ALTER TABLE `assistant_actions` ADD `scope` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `assistant_actions` ADD `tool` text;
--> statement-breakpoint
ALTER TABLE `assistant_actions` ADD `outcome` text DEFAULT 'applied' NOT NULL;
--> statement-breakpoint
ALTER TABLE `assistant_actions` ADD `reason` text;
--> statement-breakpoint
UPDATE `assistant_actions` SET `outcome` = 'failed' WHERE `status` IS NULL OR `status` >= 400;
--> statement-breakpoint
UPDATE `assistant_actions` SET `detail` = NULL;

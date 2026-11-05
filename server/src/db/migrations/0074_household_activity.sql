-- SPL-04: a household keeps a log of what was added, changed, removed or settled. Additive: one
-- table. Households that exist already start with an empty log.
CREATE TABLE `household_activity` (
  `id` text PRIMARY KEY NOT NULL,
  `group_id` text NOT NULL REFERENCES `household_groups`(`id`) ON DELETE CASCADE,
  `time` text NOT NULL,
  `kind` text NOT NULL,
  `event_id` text,
  `summary` text NOT NULL,
  `source` text DEFAULT 'owner' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `household_activity_group_time` ON `household_activity` (`group_id`,`time`);

-- Recurring items (schedules) shared with a household: the Household page lists each with its
-- next date, everyone's share and the payments not yet shared. An item is shared with at most
-- one household.
CREATE TABLE `household_recurring_bills` (
  `schedule_id` text PRIMARY KEY NOT NULL REFERENCES `schedules`(`id`) ON DELETE CASCADE,
  `group_id` text NOT NULL REFERENCES `household_groups`(`id`) ON DELETE CASCADE,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `household_recurring_bills_group` ON `household_recurring_bills` (`group_id`);

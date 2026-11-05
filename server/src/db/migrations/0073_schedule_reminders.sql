-- FINX-02: a bill or payday can send a Home Assistant notification a few days ahead. Off by
-- default: a schedule has no lead (null), and no notify service is chosen. Additive.
ALTER TABLE `schedules` ADD `reminder_days` integer;
--> statement-breakpoint
ALTER TABLE `schedule_occurrences` ADD `reminded_at` text;
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `reminder_notify_service` text;
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `reminder_show_details` integer DEFAULT 0 NOT NULL;

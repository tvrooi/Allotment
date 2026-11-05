-- Audit F-14: deleted bank imports are remembered for every synced provider, not only Up. What the
-- row was is kept so the owner can recognise it to restore (the row itself is gone). Additive.
ALTER TABLE `up_deleted_imports` ADD `date` text;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `amount` integer;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `description` text;

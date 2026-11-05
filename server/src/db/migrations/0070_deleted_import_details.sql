-- Audit F-14: deleted bank imports are remembered for every synced provider, not only Up. What the
-- row was is kept so the owner can recognise it, and Restore can recreate it: Plaid's cursor and
-- Enable Banking's window would never send it again. Additive.
ALTER TABLE `up_deleted_imports` ADD `date` text;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `amount` integer;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `description` text;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `imported_payee` text;
--> statement-breakpoint
ALTER TABLE `up_deleted_imports` ADD `notes` text;

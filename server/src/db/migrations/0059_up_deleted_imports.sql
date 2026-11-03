-- Up transactions the owner deleted in Allotment. Up keeps returning them, so the sync skips these
-- instead of importing them again (services/upSyncService.ts); Up review lists them to restore.
CREATE TABLE `up_deleted_imports` (
  `account_id` text NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  `imported_id` text NOT NULL,
  `deleted_at` text NOT NULL,
  PRIMARY KEY(`account_id`, `imported_id`)
);

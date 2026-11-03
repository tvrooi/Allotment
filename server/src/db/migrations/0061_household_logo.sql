-- A household's own picture, shown next to the payments shared with it (null = colored initial).
-- A small image data URL, like account and payee logos.
ALTER TABLE `household_groups` ADD COLUMN `logo` text;

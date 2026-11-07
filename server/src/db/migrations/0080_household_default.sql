-- The household the Household page and sidebar open first (owner-requested, 7 November 2026).
-- At most one group has 1; none means the first one. Additive.
ALTER TABLE `household_groups` ADD `is_default` integer DEFAULT 0 NOT NULL;

-- Whether a household includes bills (owner-requested, 10 November 2026): a flat with a shared
-- account does, a partner who only split groceries and outings need not. Existing households keep
-- their bills (1). Additive; turning it off only hides bills, nothing is removed.
ALTER TABLE `household_groups` ADD `include_bills` integer DEFAULT 1 NOT NULL;

-- The day the owner last set or kept a recurring item's expected amount (docs/HOUSEHOLDS.md "When a
-- bill's amount changes"). Additive and nullable: payments on or before it no longer suggest the
-- amount changed, so an intentional price rise isn't flagged against the old bills.
ALTER TABLE schedules ADD COLUMN amount_confirmed_at TEXT;

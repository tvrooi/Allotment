-- Household bill suggestions the owner said aren't bills (docs/HOUSEHOLDS.md "Bills the household
-- account pays"). Additive: one row per household and payee, so a dismissed payee isn't suggested
-- again. A payee key is `id:<payee id>` or `name:<lower-case name>`, as schedule discovery uses.
CREATE TABLE household_bill_dismissals (
	group_id TEXT NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE,
	payee_key TEXT NOT NULL,
	dismissed_at TEXT NOT NULL,
	PRIMARY KEY (group_id, payee_key)
);

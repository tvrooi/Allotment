-- The household pool accounts decide which accounts the envelope budget counts
-- (personalBudgetAccount), so changing them must change the funding revision that cached
-- budget figures are keyed by. The other inputs already had triggers (0029).
CREATE TRIGGER funding_household_pool_accounts_insert AFTER INSERT ON household_pool_accounts BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_household_pool_accounts_update AFTER UPDATE ON household_pool_accounts BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_household_pool_accounts_delete AFTER DELETE ON household_pool_accounts BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;

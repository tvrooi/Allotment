-- Up syncs fetch only recent history between full sweeps (audit F-10): when this account last
-- had one. Null = never, so the next sync is a full sweep.
ALTER TABLE up_account_mappings ADD COLUMN full_synced_at TEXT;

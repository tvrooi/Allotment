ALTER TABLE budget_settings ADD COLUMN budget_start_month TEXT CHECK (budget_start_month IS NULL OR budget_start_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]');
--> statement-breakpoint
CREATE TRIGGER funding_budget_start_update AFTER UPDATE OF budget_start_month ON budget_settings BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_budget_start_insert AFTER INSERT ON budget_settings WHEN NEW.budget_start_month IS NOT NULL BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;

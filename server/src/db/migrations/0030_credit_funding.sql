CREATE TABLE credit_card_plans (account_id text PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, enabled_from text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE TABLE credit_funding_events (id text PRIMARY KEY NOT NULL, account_id text NOT NULL REFERENCES credit_card_plans(account_id) ON DELETE CASCADE, date text NOT NULL, amount integer NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE TRIGGER funding_credit_card_plans_insert AFTER INSERT ON credit_card_plans BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_card_plans_update AFTER UPDATE ON credit_card_plans BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_card_plans_delete AFTER DELETE ON credit_card_plans BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_funding_events_insert AFTER INSERT ON credit_funding_events BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_funding_events_update AFTER UPDATE ON credit_funding_events BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_funding_events_delete AFTER DELETE ON credit_funding_events BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;

--> statement-breakpoint
CREATE TABLE credit_event_order (sequence integer PRIMARY KEY AUTOINCREMENT, kind text NOT NULL, entity_id text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX credit_event_order_identity ON credit_event_order(kind,entity_id);
--> statement-breakpoint
INSERT INTO credit_event_order(kind,entity_id) SELECT 'transaction',id FROM transactions ORDER BY created_at,id;
--> statement-breakpoint
CREATE TRIGGER credit_order_transactions AFTER INSERT ON transactions BEGIN INSERT OR IGNORE INTO credit_event_order(kind,entity_id) VALUES ('transaction',new.id); END;
--> statement-breakpoint
CREATE TRIGGER credit_order_funding AFTER INSERT ON credit_funding_events BEGIN INSERT OR IGNORE INTO credit_event_order(kind,entity_id) VALUES ('funding',new.id); END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_event_order_insert AFTER INSERT ON credit_event_order BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_event_order_update AFTER UPDATE ON credit_event_order BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;
--> statement-breakpoint
CREATE TRIGGER funding_credit_event_order_delete AFTER DELETE ON credit_event_order BEGIN INSERT INTO budget_revision (id, revision) VALUES (1, lower(hex(randomblob(16)))) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision; END;

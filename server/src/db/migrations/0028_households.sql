CREATE TABLE household_groups (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, currency TEXT NOT NULL, account_id TEXT UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT);
--> statement-breakpoint
CREATE TABLE household_people (id TEXT PRIMARY KEY NOT NULL, group_id TEXT NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE, name TEXT NOT NULL, is_self INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE household_events (id TEXT PRIMARY KEY NOT NULL, group_id TEXT NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE, kind TEXT NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, payer_id TEXT REFERENCES household_people(id) ON DELETE RESTRICT, recipient_id TEXT REFERENCES household_people(id) ON DELETE RESTRICT, transaction_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT, reverses_id TEXT REFERENCES household_events(id) ON DELETE RESTRICT, bill_id TEXT);
--> statement-breakpoint
CREATE TABLE household_shares (id TEXT PRIMARY KEY NOT NULL, event_id TEXT NOT NULL REFERENCES household_events(id) ON DELETE CASCADE, person_id TEXT NOT NULL REFERENCES household_people(id) ON DELETE RESTRICT, amount INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE household_bills (id TEXT PRIMARY KEY NOT NULL, group_id TEXT NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE, description TEXT NOT NULL, due_date TEXT NOT NULL, amount INTEGER NOT NULL, personal_share INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0, schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL);

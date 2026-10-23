CREATE TABLE securities (
	id TEXT PRIMARY KEY NOT NULL,
	symbol TEXT NOT NULL CHECK (length(trim(symbol)) BETWEEN 1 AND 20),
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
	kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('stock', 'etf', 'fund', 'bond', 'crypto', 'other')),
	currency TEXT NOT NULL CHECK (length(currency) = 3),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX securities_symbol_currency_idx ON securities (symbol COLLATE NOCASE, currency);
--> statement-breakpoint
CREATE TABLE security_prices (
	security_id TEXT NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
	date TEXT NOT NULL,
	price INTEGER NOT NULL CHECK (price >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (security_id, date)
);
--> statement-breakpoint
CREATE TABLE holdings (
	id TEXT PRIMARY KEY NOT NULL,
	account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	security_id TEXT NOT NULL REFERENCES securities(id) ON DELETE RESTRICT,
	quantity INTEGER NOT NULL CHECK (quantity >= 0),
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX holdings_account_security_idx ON holdings (account_id, security_id);
--> statement-breakpoint
CREATE TABLE tax_lots (
	id TEXT PRIMARY KEY NOT NULL,
	holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
	acquired_on TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	cost_basis INTEGER CHECK (cost_basis IS NULL OR cost_basis >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX tax_lots_holding_idx ON tax_lots (holding_id);

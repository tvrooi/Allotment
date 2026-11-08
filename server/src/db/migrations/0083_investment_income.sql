-- D3b dividends and franking (docs/INVESTMENT-SALES-AND-INCOME.md §5.1). Additive: income paid on
-- a holding (a dividend, a trust distribution or interest), with its item 11 parts and an
-- optional lot its reinvested units became; a register row a sale or an income row may be
-- linked to (the deposit; it changes no category or balance); and files linked to either.
CREATE TABLE investment_income (
	id TEXT PRIMARY KEY NOT NULL,
	holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
	paid_on TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('dividend', 'distribution', 'interest')),
	amount INTEGER NOT NULL CHECK (amount >= 0),
	unfranked INTEGER NOT NULL DEFAULT 0 CHECK (unfranked >= 0),
	franked INTEGER NOT NULL DEFAULT 0 CHECK (franked >= 0),
	franking_credit INTEGER NOT NULL DEFAULT 0 CHECK (franking_credit >= 0),
	withheld INTEGER NOT NULL DEFAULT 0 CHECK (withheld >= 0),
	reinvested_lot_id TEXT REFERENCES tax_lots(id) ON DELETE SET NULL,
	transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX investment_income_holding_idx ON investment_income (holding_id);
--> statement-breakpoint
CREATE INDEX investment_income_paid_on_idx ON investment_income (paid_on);
--> statement-breakpoint
CREATE INDEX investment_income_transaction_idx ON investment_income (transaction_id);
--> statement-breakpoint
ALTER TABLE `investment_sales` ADD `transaction_id` text REFERENCES transactions(id) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX investment_sales_transaction_idx ON investment_sales (transaction_id);
--> statement-breakpoint
ALTER TABLE `document_links` ADD `investment_sale_id` text REFERENCES investment_sales(id) ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE `document_links` ADD `investment_income_id` text REFERENCES investment_income(id) ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX document_links_investment_sale_idx ON document_links (investment_sale_id, document_id) WHERE investment_sale_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX document_links_investment_income_idx ON document_links (investment_income_id, document_id) WHERE investment_income_id IS NOT NULL;

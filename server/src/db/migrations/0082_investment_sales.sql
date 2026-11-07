-- D3a investment sales (docs/INVESTMENT-SALES-AND-INCOME.md §5.1). Additive: a sale of units
-- from a holding, the parcels (lots) it drew from, and the net capital losses the owner carried
-- into Allotment from earlier years. Sales cascade with their holding (an account's removal);
-- the service refuses to remove a holding with sales or a lot with parcels on its own.
CREATE TABLE investment_sales (
	id TEXT PRIMARY KEY NOT NULL,
	holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
	sold_on TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	proceeds INTEGER NOT NULL CHECK (proceeds >= 0),
	fees INTEGER NOT NULL DEFAULT 0 CHECK (fees >= 0),
	notes TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX investment_sales_holding_idx ON investment_sales (holding_id);
--> statement-breakpoint
CREATE INDEX investment_sales_sold_on_idx ON investment_sales (sold_on);
--> statement-breakpoint
CREATE TABLE investment_sale_parcels (
	sale_id TEXT NOT NULL REFERENCES investment_sales(id) ON DELETE CASCADE,
	lot_id TEXT NOT NULL REFERENCES tax_lots(id) ON DELETE CASCADE,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	PRIMARY KEY (sale_id, lot_id)
);
--> statement-breakpoint
CREATE INDEX investment_sale_parcels_lot_idx ON investment_sale_parcels (lot_id);
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `capital_losses_carried_in` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `capital_losses_carried_in_fy` integer;

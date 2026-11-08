-- D4a working from home (docs/TAX-CAR-AND-HOME.md §5.1). Additive: a daily log of hours worked at
-- home, a per-year rate override with notes, the snapshot a lodged year records of these figures
-- (so a later change shows as an amendment), and the homeYear Files link kind.
CREATE TABLE tax_home_hours (
	work_date TEXT PRIMARY KEY NOT NULL,
	minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE tax_home_years (
	financial_year INTEGER PRIMARY KEY NOT NULL,
	rate_tenths INTEGER CHECK (rate_tenths IS NULL OR rate_tenths BETWEEN 1 AND 10000),
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE tax_lodged_figures (
	financial_year INTEGER NOT NULL REFERENCES tax_lodged_years(financial_year) ON DELETE CASCADE,
	part TEXT NOT NULL,
	figures TEXT NOT NULL,
	recorded_at TEXT NOT NULL,
	PRIMARY KEY (financial_year, part)
);
--> statement-breakpoint
ALTER TABLE `document_links` ADD `home_year_fy` integer REFERENCES tax_home_years(financial_year) ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX document_links_home_year_idx ON document_links (home_year_fy, document_id) WHERE home_year_fy IS NOT NULL;

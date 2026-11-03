-- A budget can start on a day, not only a month (a "fresh start" when the first bank is
-- connected mid-month): activity before it doesn't count in envelopes. Null = the start
-- month's first day. When set, it is in budget_start_month's month.
ALTER TABLE budget_settings ADD COLUMN budget_start_day TEXT CHECK (budget_start_day IS NULL OR budget_start_day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]');

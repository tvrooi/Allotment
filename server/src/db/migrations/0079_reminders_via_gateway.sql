-- D2b (docs/MULTI-USER-EMAIL-AND-REMINDERS.md): behind the multi-user gateway, a budget's bill
-- reminders go to its person's own phone or email, which the gateway knows; the budget only
-- says whether to send them. Off by default; a single budget ignores it. Additive.
ALTER TABLE `budget_settings` ADD `reminders_via_gateway` integer DEFAULT 0 NOT NULL;

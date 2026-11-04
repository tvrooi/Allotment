-- Depreciating assets, phase 3 (docs/DEPRECIATING-ASSETS-PLAN.md): the low-value pool (D6).
-- The financial year an asset joined the pool; its own schedule stops there. Additive.
ALTER TABLE `depreciating_assets` ADD `pooled_fy` integer;

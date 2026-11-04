-- The sidebar's optional features (docs/AUDIT-2026-11.md, decision I-4): the person's choice for
-- each, as JSON { feature: 'shown' | 'hidden' }. A feature with no choice shows once it is in use.
-- Presentation only, like the rest of guide_progress: not in backups, no token reaches it.
ALTER TABLE guide_progress ADD COLUMN nav_features TEXT NOT NULL DEFAULT '{}';

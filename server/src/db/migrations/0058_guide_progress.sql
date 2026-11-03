-- Guides and tips (docs/GUIDES.md): which guides this person has seen and whether tips are on.
-- One row, id 'default'. Each person in multi-user mode has their own budget, so this follows
-- the person to every device. Presentation only: not in backups, not for an access token.
CREATE TABLE `guide_progress` (
  `id` text PRIMARY KEY NOT NULL,
  `tips_enabled` integer DEFAULT 1 NOT NULL,
  `page_guides_enabled` integer DEFAULT 1 NOT NULL,
  `welcome_tour` text DEFAULT 'offer' NOT NULL,
  `guides_notice` integer DEFAULT 0 NOT NULL,
  `seen_guides` text DEFAULT '{}' NOT NULL,
  `dismissed_tips` text DEFAULT '[]' NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
-- A budget already in use: its owner knows their way around. No tour, no tips and no page
-- guides unless they turn them on; once, a note says where guides are now.
INSERT INTO `guide_progress` (`id`, `tips_enabled`, `page_guides_enabled`, `welcome_tour`, `guides_notice`)
SELECT 'default', 0, 0, 'dismissed', 1
WHERE EXISTS (SELECT 1 FROM `accounts`) OR EXISTS (SELECT 1 FROM `transactions`);

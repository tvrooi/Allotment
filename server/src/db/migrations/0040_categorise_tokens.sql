CREATE TABLE access_tokens_new (
	id TEXT PRIMARY KEY NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
	scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'categorise')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT NOT NULL,
	last_used_at TEXT,
	revoked_at TEXT
);
--> statement-breakpoint
INSERT INTO access_tokens_new (id, token_hash, name, scope, created_at, expires_at, last_used_at, revoked_at)
	SELECT id, token_hash, name, scope, created_at, expires_at, last_used_at, revoked_at FROM access_tokens;
--> statement-breakpoint
DROP TABLE access_tokens;
--> statement-breakpoint
ALTER TABLE access_tokens_new RENAME TO access_tokens;

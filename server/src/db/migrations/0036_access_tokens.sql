CREATE TABLE access_tokens (
	id TEXT PRIMARY KEY NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
	scope TEXT NOT NULL DEFAULT 'read' CHECK (scope = 'read'),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT NOT NULL,
	last_used_at TEXT,
	revoked_at TEXT
);

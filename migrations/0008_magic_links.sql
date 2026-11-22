-- Sign in with an emailed link: opt-in per member (set while signed in), single-use links kept only as hashes.
ALTER TABLE members ADD COLUMN magic_on INTEGER NOT NULL DEFAULT 0;
CREATE TABLE magic_links (token_hash TEXT PRIMARY KEY, jellyfin_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX magic_links_member ON magic_links(jellyfin_id);

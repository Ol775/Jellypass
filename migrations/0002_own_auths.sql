-- Moments when Jellypass itself authenticated a member against Jellyfin (sign-in, re-checks for password/email changes).
-- Used to tell Jellypass's own Jellyfin sessions apart from real sign-ins without trusting the client-chosen device name.
CREATE TABLE own_auths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_id TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX own_auths_user ON own_auths(jellyfin_id, at);

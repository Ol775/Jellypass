-- Account and security: per-browser labels on portal sessions, a security-alert preference, and the password-changed date.
-- Additive only (defaults keep the previously deployed code working).
ALTER TABLE sessions ADD COLUMN label TEXT;
ALTER TABLE sessions ADD COLUMN city TEXT;
ALTER TABLE sessions ADD COLUMN created_at TEXT;
ALTER TABLE members ADD COLUMN alerts_on INTEGER NOT NULL DEFAULT 1;
ALTER TABLE members ADD COLUMN password_changed_at TEXT;

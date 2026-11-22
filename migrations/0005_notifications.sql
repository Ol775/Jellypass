-- Opt-in notifications. alerts_email replaces alerts_on (which defaulted to on): everyone starts off and chooses.
ALTER TABLE members ADD COLUMN alerts_email INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN alerts_banner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN weekly_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN ready_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN secured_at TEXT;           -- last "this wasn't me" press
ALTER TABLE signins ADD COLUMN unusual INTEGER NOT NULL DEFAULT 0;
-- One row per notice already sent, so nothing is emailed twice (stream warnings, ready requests, digests).
CREATE TABLE notice_log (key TEXT PRIMARY KEY, at TEXT NOT NULL);
-- Failed portal sign-ins, kept 14 days, for the admin digest only.
CREATE TABLE signin_failures (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, ip TEXT, at TEXT NOT NULL);
CREATE INDEX signin_failures_at ON signin_failures(at);

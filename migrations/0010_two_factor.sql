-- Optional two-step sign-in: an authenticator app (TOTP), passkeys (WebAuthn) and single-use recovery codes. Additive only.
CREATE TABLE mfa_totp (jellyfin_id TEXT PRIMARY KEY, secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, last_step INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE passkeys (id TEXT PRIMARY KEY, jellyfin_id TEXT NOT NULL, jwk TEXT NOT NULL, alg INTEGER NOT NULL, counter INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT);
CREATE INDEX passkeys_member ON passkeys(jellyfin_id);
CREATE TABLE mfa_recovery (code_hash TEXT PRIMARY KEY, jellyfin_id TEXT NOT NULL);
CREATE INDEX mfa_recovery_member ON mfa_recovery(jellyfin_id);
-- Short-lived: a sign-in waiting for its second step ('sin:<hash of token>') or a passkey being registered ('reg:<jellyfin id>').
CREATE TABLE mfa_challenges (key TEXT PRIMARY KEY, jellyfin_id TEXT NOT NULL, challenge TEXT, expires_at TEXT NOT NULL);

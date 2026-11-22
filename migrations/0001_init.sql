-- Jellypass initial schema.
CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,        -- {libraries:"all"|string[], bitrateLimit:number, remoteAccess:boolean, requestRights:"none"|"request"|"auto"}
  membership_days INTEGER,          -- null = no expiry
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  preset_id TEXT NOT NULL REFERENCES presets(id),
  email TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_sent_at TEXT
);

CREATE TABLE members (
  jellyfin_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  contact_email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  onboarding_state TEXT NOT NULL DEFAULT '{}',
  invited_by TEXT,
  preset_id TEXT REFERENCES presets(id),
  hidden_history_json TEXT NOT NULL DEFAULT '[]',
  reminder_days_sent TEXT NOT NULL DEFAULT '[]',
  reminders_on INTEGER NOT NULL DEFAULT 1,
  seerr_user_id INTEGER,
  expiry_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  jellyfin_id TEXT NOT NULL,
  username TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  csrf TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(jellyfin_id);

CREATE TABLE reset_codes (
  jellyfin_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL
);

CREATE TABLE email_codes (
  jellyfin_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE TABLE signins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,             -- 'portal' | 'activity'
  jellyfin_id TEXT NOT NULL,
  device TEXT,
  ip TEXT,
  city TEXT,
  lat REAL,
  lng REAL,
  seen_at TEXT NOT NULL,
  UNIQUE (source, jellyfin_id, device, ip, seen_at)
);
CREATE INDEX signins_user ON signins(jellyfin_id, seen_at);
CREATE INDEX signins_ip ON signins(ip);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',   -- 'info' | 'incident'
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE status_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,
  ok INTEGER NOT NULL,
  latency_ms INTEGER,
  at TEXT NOT NULL
);
CREATE INDEX status_service_at ON status_checks(service, at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE help_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_id TEXT NOT NULL,
  username TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  diagnostics TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- API keys an admin has set from the app. Encrypted (AES-GCM) with the KEYS_SECRET Worker secret; they override the Worker secrets.
CREATE TABLE integration_keys (
  name TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL
);

-- Default presets: PROPOSED values, to be reviewed by the owner in beta.
INSERT INTO presets (id, name, config_json, membership_days, is_default) VALUES
 ('preset-standard','Standard','{"libraries":"all","bitrateLimit":20000000,"remoteAccess":true,"requestRights":"request"}',365,1),
 ('preset-family','Family','{"libraries":"all","bitrateLimit":0,"remoteAccess":true,"requestRights":"auto"}',NULL,1),
 ('preset-guest','Guest','{"libraries":"all","bitrateLimit":8000000,"remoteAccess":true,"requestRights":"none"}',30,1);

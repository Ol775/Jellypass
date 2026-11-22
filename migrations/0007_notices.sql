-- Notices an admin sends from Settings: shown in members' notification bell, optionally also pushed to their devices.
CREATE TABLE notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, pushed INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);

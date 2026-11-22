-- Own star ratings (1-5) per title, shown on the history page. Only the member sees theirs.
CREATE TABLE ratings (jellyfin_id TEXT NOT NULL, item_id TEXT NOT NULL, stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5), at TEXT NOT NULL, PRIMARY KEY (jellyfin_id, item_id));
-- Browser push subscriptions, one per device. Having one is the opt-in for push notices.
CREATE TABLE push_subscriptions (endpoint TEXT PRIMARY KEY, jellyfin_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL);
CREATE INDEX push_subscriptions_member ON push_subscriptions(jellyfin_id);

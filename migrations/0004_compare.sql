-- Opt-in comparison of watch history between members. Off by default; additive only.
ALTER TABLE members ADD COLUMN compare_on INTEGER NOT NULL DEFAULT 0;

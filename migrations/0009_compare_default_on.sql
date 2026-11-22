-- Compare is now on by default (opt out). Everyone is switched on except members who explicitly switched it off:
-- their latest compare.on / compare.off audit entry is "off". New members get compare_on = 1 at insert (src/members.ts, src/invites.ts).
UPDATE members SET compare_on = 1
WHERE compare_on = 0
  AND NOT EXISTS (
    SELECT 1 FROM audit a
    WHERE a.action = 'compare.off' AND a.target = members.jellyfin_id
      AND a.id > COALESCE((SELECT MAX(b.id) FROM audit b WHERE b.action = 'compare.on' AND b.target = members.jellyfin_id), 0)
  );

-- Remove duplicate players, keeping only the one with the highest points for each name/gender combination
WITH duplicates_to_delete AS (
  SELECT id
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY name, gender ORDER BY points DESC, created_at ASC) as row_num
    FROM players
  ) ranked
  WHERE row_num > 1
)
DELETE FROM players 
WHERE id IN (SELECT id FROM duplicates_to_delete);
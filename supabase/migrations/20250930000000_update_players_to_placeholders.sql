-- Update existing players to use placeholder names
-- Reset all players to placeholder format with unconfirmed status

-- Update female players to placeholder names
UPDATE players 
SET 
  name = CASE position
    WHEN 1 THEN 'Female Player 1'
    WHEN 2 THEN 'Female Player 2'
    WHEN 3 THEN 'Female Player 3'
    WHEN 4 THEN 'Female Player 4'
    WHEN 5 THEN 'Female Player 5'
    WHEN 6 THEN 'Female Player 6'
    WHEN 7 THEN 'Female Player 7'
    WHEN 8 THEN 'Female Player 8'
  END,
  is_confirmed = false,
  email = NULL,
  registered_at = NULL
WHERE gender = 'female' AND position BETWEEN 1 AND 8;

-- Update male players to placeholder names  
UPDATE players 
SET 
  name = CASE position
    WHEN 1 THEN 'Male Player 1'
    WHEN 2 THEN 'Male Player 2'
    WHEN 3 THEN 'Male Player 3'
    WHEN 4 THEN 'Male Player 4'
    WHEN 5 THEN 'Male Player 5'
    WHEN 6 THEN 'Male Player 6'
    WHEN 7 THEN 'Male Player 7'
    WHEN 8 THEN 'Male Player 8'
  END,
  is_confirmed = false,
  email = NULL,
  registered_at = NULL
WHERE gender = 'male' AND position BETWEEN 1 AND 8;

-- Reset all scores to 0
UPDATE players 
SET 
  points = 0,
  total_scores = 0,
  matches_played = 0
WHERE gender IN ('male', 'female');

-- If any players are missing, insert placeholder players
INSERT INTO players (name, gender, position, points, total_scores, matches_played, is_confirmed)
SELECT 
  CASE 
    WHEN gender = 'female' THEN 'Female Player ' || position::text
    WHEN gender = 'male' THEN 'Male Player ' || position::text
  END as name,
  gender,
  position,
  0 as points,
  0 as total_scores, 
  0 as matches_played,
  false as is_confirmed
FROM (
  SELECT 'female' as gender, generate_series(1, 8) as position
  UNION ALL
  SELECT 'male' as gender, generate_series(1, 8) as position
) placeholder_data
WHERE NOT EXISTS (
  SELECT 1 FROM players p 
  WHERE p.gender = placeholder_data.gender 
  AND p.position = placeholder_data.position
);
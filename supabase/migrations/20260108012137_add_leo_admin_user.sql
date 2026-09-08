-- Add Leo as an admin user to the players table
-- This ensures Leo has admin access in the application

-- Insert Leo as a placeholder/admin player in both genders if not exists
INSERT INTO players (id, name, gender, position, points, total_scores, matches_played, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'Leo Admin',
    gender_value,
    COALESCE(MAX(position) + 1, 0),
    0,
    0,
    0,
    NOW(),
    NOW()
FROM 
    (SELECT 'male' as gender_value UNION SELECT 'female' as gender_value) genders
LEFT JOIN players p ON p.gender = genders.gender_value
GROUP BY genders.gender_value
ON CONFLICT DO NOTHING;

-- Create a settings entry to indicate admin configuration is complete
INSERT INTO tournament_config (key, value)
VALUES ('admin_setup_complete', json_build_object('completed', true, 'timestamp', NOW()))
ON CONFLICT (key) DO UPDATE SET 
    value = json_build_object('completed', true, 'timestamp', NOW()),
    updated_at = NOW();
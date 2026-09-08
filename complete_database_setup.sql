-- Complete database setup for Sandy Scorekeeper Tournament System
-- Run this in Supabase SQL Editor

-- First, ensure we have the correct players table structure
-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add position column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'position') THEN
        ALTER TABLE players ADD COLUMN position INTEGER;
    END IF;
    
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'email') THEN
        ALTER TABLE players ADD COLUMN email TEXT UNIQUE;
    END IF;
    
    -- Add is_confirmed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'is_confirmed') THEN
        ALTER TABLE players ADD COLUMN is_confirmed BOOLEAN DEFAULT false;
    END IF;
    
    -- Add registered_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'registered_at') THEN
        ALTER TABLE players ADD COLUMN registered_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add matches_played column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'matches_played') THEN
        ALTER TABLE players ADD COLUMN matches_played INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_date DATE NOT NULL,
  max_players_per_gender INTEGER DEFAULT 8,
  registration_cutoff_days INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for settings table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Anyone can view settings') THEN
        CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Anyone can insert settings') THEN
        CREATE POLICY "Anyone can insert settings" ON settings FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Anyone can update settings') THEN
        CREATE POLICY "Anyone can update settings" ON settings FOR UPDATE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Anyone can delete settings') THEN
        CREATE POLICY "Anyone can delete settings" ON settings FOR DELETE USING (true);
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_confirmed_gender ON players(is_confirmed, gender);
CREATE INDEX IF NOT EXISTS idx_players_registered_at ON players(registered_at);

-- Function to check if registration is allowed
CREATE OR REPLACE FUNCTION can_register(p_gender TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_count INTEGER;
    tournament_date DATE;
    cutoff_days INTEGER;
BEGIN
    -- Get tournament settings
    SELECT s.tournament_date, s.max_players_per_gender, s.registration_cutoff_days
    INTO tournament_date, max_count, cutoff_days
    FROM settings s
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no settings found, allow registration
    IF tournament_date IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if registration is still open (not within cutoff period)
    IF CURRENT_DATE >= tournament_date - INTERVAL '1 day' * cutoff_days THEN
        RETURN false;
    END IF;
    
    -- Count confirmed players of the specified gender
    SELECT COUNT(*)
    INTO current_count
    FROM players
    WHERE gender = p_gender AND is_confirmed = true;
    
    -- Check if there's space
    RETURN current_count < max_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get available spots
CREATE OR REPLACE FUNCTION get_available_spots()
RETURNS TABLE(gender TEXT, available_spots INTEGER, total_spots INTEGER) AS $$
DECLARE
    max_count INTEGER;
BEGIN
    -- Get max players per gender from settings
    SELECT s.max_players_per_gender
    INTO max_count
    FROM settings s
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Default to 8 if no settings
    IF max_count IS NULL THEN
        max_count := 8;
    END IF;
    
    RETURN QUERY
    SELECT 
        p.gender,
        (max_count - COUNT(*))::INTEGER as available_spots,
        max_count as total_spots
    FROM (
        SELECT 'male'::TEXT as gender
        UNION ALL
        SELECT 'female'::TEXT as gender
    ) p
    LEFT JOIN players pl ON pl.gender = p.gender AND pl.is_confirmed = true
    GROUP BY p.gender;
END;
$$ LANGUAGE plpgsql;

-- Function to check if player can unregister
CREATE OR REPLACE FUNCTION can_unregister(player_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    tournament_date DATE;
    cutoff_days INTEGER;
    is_confirmed BOOLEAN;
BEGIN
    -- Check if player is confirmed
    SELECT p.is_confirmed
    INTO is_confirmed
    FROM players p
    WHERE p.email = player_email;
    
    IF NOT is_confirmed THEN
        RETURN false;
    END IF;
    
    -- Get tournament settings
    SELECT s.tournament_date, s.registration_cutoff_days
    INTO tournament_date, cutoff_days
    FROM settings s
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no settings found, allow unregistration
    IF tournament_date IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if unregistration is still allowed (not within cutoff period)
    RETURN CURRENT_DATE < tournament_date - INTERVAL '1 day' * cutoff_days;
END;
$$ LANGUAGE plpgsql;

-- Clear existing data in correct order (foreign key constraints)
-- Delete matches first, then final_matches, then players
DELETE FROM matches;
DELETE FROM final_matches WHERE id IS NOT NULL;
DELETE FROM players;

-- Insert placeholder players with proper structure
INSERT INTO players (name, gender, position, points, total_scores, matches_played, is_confirmed, email, registered_at) VALUES
-- Female players
('Female Player 1', 'female', 1, 0, 0, 0, false, null, null),
('Female Player 2', 'female', 2, 0, 0, 0, false, null, null),
('Female Player 3', 'female', 3, 0, 0, 0, false, null, null),
('Female Player 4', 'female', 4, 0, 0, 0, false, null, null),
('Female Player 5', 'female', 5, 0, 0, 0, false, null, null),
('Female Player 6', 'female', 6, 0, 0, 0, false, null, null),
('Female Player 7', 'female', 7, 0, 0, 0, false, null, null),
('Female Player 8', 'female', 8, 0, 0, 0, false, null, null),
-- Male players
('Male Player 1', 'male', 1, 0, 0, 0, false, null, null),
('Male Player 2', 'male', 2, 0, 0, 0, false, null, null),
('Male Player 3', 'male', 3, 0, 0, 0, false, null, null),
('Male Player 4', 'male', 4, 0, 0, 0, false, null, null),
('Male Player 5', 'male', 5, 0, 0, 0, false, null, null),
('Male Player 6', 'male', 6, 0, 0, 0, false, null, null),
('Male Player 7', 'male', 7, 0, 0, 0, false, null, null),
('Male Player 8', 'male', 8, 0, 0, 0, false, null, null);

-- Insert default tournament settings (set date to 30 days from now)
INSERT INTO settings (tournament_date, max_players_per_gender, registration_cutoff_days)
VALUES (CURRENT_DATE + INTERVAL '30 days', 8, 3)
ON CONFLICT DO NOTHING;

-- Verify everything was created correctly
SELECT 'Players created:', COUNT(*) FROM players;
SELECT 'Settings created:', COUNT(*) FROM settings;
SELECT 'Available spots test:' as test, * FROM get_available_spots();
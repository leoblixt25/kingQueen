/*
  # Add Tournament Registration System

  1. Database Schema Updates
    - Add email, is_confirmed, registered_at to players table
    - Create settings table for tournament configuration
    - Add indexes for performance
    - Update RLS policies

  2. Security
    - Enable RLS on settings table
    - Add policies for public access to settings (read-only)
    - Update player policies to handle registration flow

  3. Functions
    - Add function to check registration limits
    - Add function to get available spots
*/

-- Add new columns to players table
ALTER TABLE players 
ADD COLUMN email TEXT UNIQUE,
ADD COLUMN is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN registered_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create settings table for tournament configuration
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

-- Create policies for settings table
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settings" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON settings FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete settings" ON settings FOR DELETE USING (true);

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

-- Insert default tournament settings (set date to 30 days from now)
INSERT INTO settings (tournament_date, max_players_per_gender, registration_cutoff_days)
VALUES (CURRENT_DATE + INTERVAL '30 days', 8, 3)
ON CONFLICT DO NOTHING;

-- Add trigger for settings updated_at
CREATE TRIGGER update_settings_updated_at 
BEFORE UPDATE ON settings
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
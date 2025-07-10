-- Create clean tournament database schema
DROP TABLE IF EXISTS final_matches CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Players table with fixed UUIDs
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  position INTEGER NOT NULL, -- Fixed position 0-7
  points INTEGER NOT NULL DEFAULT 0,
  total_scores INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gender, position)
);

-- Matches table with fixed combinations
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  match_number INTEGER NOT NULL,
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  player3_id UUID NOT NULL REFERENCES players(id),
  player4_id UUID NOT NULL REFERENCES players(id),
  score1 INTEGER NOT NULL DEFAULT 0,
  score2 INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gender, match_number)
);

-- Final matches table
CREATE TABLE final_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  male_king_id UUID REFERENCES players(id),
  female_queen_id UUID REFERENCES players(id),
  male_prince_id UUID REFERENCES players(id),
  female_princess_id UUID REFERENCES players(id),
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  winner_team INTEGER NULL CHECK (winner_team IN (1, 2)),
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament config for settings
CREATE TABLE tournament_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_config ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (public tournament)
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on final_matches" ON final_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tournament_config" ON tournament_config FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_final_matches_updated_at BEFORE UPDATE ON final_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournament_config_updated_at BEFORE UPDATE ON tournament_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate player stats
CREATE OR REPLACE FUNCTION recalculate_player_stats()
RETURNS TRIGGER AS $$
DECLARE
    p1_id UUID;
    p2_id UUID;
    p3_id UUID;
    p4_id UUID;
    winner_points INTEGER := 2;
    loser_points INTEGER := 1;
BEGIN
    -- Get player IDs from the match
    p1_id := NEW.player1_id;
    p2_id := NEW.player2_id;
    p3_id := NEW.player3_id;
    p4_id := NEW.player4_id;
    
    -- Reset all players' stats for this gender and recalculate from scratch
    WITH match_stats AS (
        SELECT 
            player_id,
            SUM(points_earned) as total_points,
            SUM(score_earned) as total_scores,
            COUNT(*) as matches_played
        FROM (
            -- Player 1 stats
            SELECT 
                m.player1_id as player_id,
                CASE 
                    WHEN m.score1 > m.score2 THEN winner_points
                    ELSE loser_points
                END as points_earned,
                m.score1 as score_earned
            FROM matches m
            WHERE m.gender = NEW.gender AND m.is_completed = true
            
            UNION ALL
            
            -- Player 2 stats  
            SELECT 
                m.player2_id as player_id,
                CASE 
                    WHEN m.score1 > m.score2 THEN winner_points
                    ELSE loser_points
                END as points_earned,
                m.score1 as score_earned
            FROM matches m
            WHERE m.gender = NEW.gender AND m.is_completed = true
            
            UNION ALL
            
            -- Player 3 stats
            SELECT 
                m.player3_id as player_id,
                CASE 
                    WHEN m.score2 > m.score1 THEN winner_points
                    ELSE loser_points
                END as points_earned,
                m.score2 as score_earned
            FROM matches m
            WHERE m.gender = NEW.gender AND m.is_completed = true
            
            UNION ALL
            
            -- Player 4 stats
            SELECT 
                m.player4_id as player_id,
                CASE 
                    WHEN m.score2 > m.score1 THEN winner_points
                    ELSE loser_points
                END as points_earned,
                m.score2 as score_earned
            FROM matches m
            WHERE m.gender = NEW.gender AND m.is_completed = true
        ) all_stats
        GROUP BY player_id
    )
    UPDATE players 
    SET 
        points = COALESCE(match_stats.total_points, 0),
        total_scores = COALESCE(match_stats.total_scores, 0),
        matches_played = COALESCE(match_stats.matches_played, 0)
    FROM match_stats 
    WHERE players.id = match_stats.player_id;
    
    -- Reset stats for players with no completed matches in this gender
    UPDATE players 
    SET points = 0, total_scores = 0, matches_played = 0
    WHERE gender = NEW.gender 
    AND id NOT IN (
        SELECT DISTINCT unnest(ARRAY[player1_id, player2_id, player3_id, player4_id])
        FROM matches 
        WHERE gender = NEW.gender AND is_completed = true
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate stats when match is updated
CREATE TRIGGER recalculate_stats_on_match_update
    AFTER UPDATE ON matches
    FOR EACH ROW
    WHEN (NEW.is_completed = true)
    EXECUTE FUNCTION recalculate_player_stats();
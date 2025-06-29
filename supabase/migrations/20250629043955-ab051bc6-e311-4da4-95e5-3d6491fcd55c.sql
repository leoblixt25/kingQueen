
-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  points INTEGER NOT NULL DEFAULT 0,
  total_scores INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id UUID REFERENCES public.players(id) NOT NULL,
  player2_id UUID REFERENCES public.players(id) NOT NULL,
  player3_id UUID REFERENCES public.players(id) NOT NULL,
  player4_id UUID REFERENCES public.players(id) NOT NULL,
  score1 INTEGER NOT NULL DEFAULT 0,
  score2 INTEGER NOT NULL DEFAULT 0,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  match_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create final match table
CREATE TABLE public.final_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team1_set1 INTEGER,
  team1_set2 INTEGER,
  team1_set3 INTEGER,
  team2_set1 INTEGER,
  team2_set2 INTEGER,
  team2_set3 INTEGER,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  winner_team TEXT CHECK (winner_team IN ('team1', 'team2')),
  male_winner TEXT,
  female_winner TEXT,
  male_runner_up TEXT,
  female_runner_up TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (these tables can be public for this use case)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_matches ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since this is a tournament tracker)
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete players" ON public.players FOR DELETE USING (true);

CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update matches" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete matches" ON public.matches FOR DELETE USING (true);

CREATE POLICY "Anyone can view final matches" ON public.final_matches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert final matches" ON public.final_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update final matches" ON public.final_matches FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete final matches" ON public.final_matches FOR DELETE USING (true);

-- Enable realtime for live updates
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.final_matches REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.final_matches;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_final_matches_updated_at
  BEFORE UPDATE ON public.final_matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

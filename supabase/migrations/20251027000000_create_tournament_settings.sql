-- Create tournament_settings table
CREATE TABLE public.tournament_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_type TEXT NOT NULL CHECK (tournament_type IN ('male', 'female', 'mixed')),
  player_count INTEGER NOT NULL CHECK (player_count IN (4, 8, 12)),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (since this is tournament info)
CREATE POLICY "Anyone can view tournament settings" ON public.tournament_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tournament settings" ON public.tournament_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament settings" ON public.tournament_settings FOR UPDATE USING (true);

-- Enable realtime for live updates
ALTER TABLE public.tournament_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_settings;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER handle_tournament_settings_updated_at
  BEFORE UPDATE ON public.tournament_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
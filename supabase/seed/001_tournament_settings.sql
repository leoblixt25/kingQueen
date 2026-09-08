-- Insert default tournament settings
INSERT INTO public.tournament_settings (tournament_type, player_count, is_active)
VALUES ('mixed', 8, true)
ON CONFLICT DO NOTHING;
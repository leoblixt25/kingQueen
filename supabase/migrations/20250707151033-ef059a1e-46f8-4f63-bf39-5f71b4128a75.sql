-- Add foreign key constraints to matches table for proper joins
ALTER TABLE public.matches
ADD CONSTRAINT matches_player1_id_fkey 
FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.matches
ADD CONSTRAINT matches_player2_id_fkey 
FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.matches
ADD CONSTRAINT matches_player3_id_fkey 
FOREIGN KEY (player3_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.matches
ADD CONSTRAINT matches_player4_id_fkey 
FOREIGN KEY (player4_id) REFERENCES public.players(id) ON DELETE CASCADE;
-- Add columns to store individual set scores for final matches
ALTER TABLE public.final_matches 
ADD COLUMN team1_set1 INTEGER,
ADD COLUMN team1_set2 INTEGER, 
ADD COLUMN team1_set3 INTEGER,
ADD COLUMN team2_set1 INTEGER,
ADD COLUMN team2_set2 INTEGER,
ADD COLUMN team2_set3 INTEGER;
import { supabase } from '@/integrations/supabase/client';
import { Player, Match, FinalMatch } from '@/types';
import { initializeDefaultPlayers } from './playerUtils';
import { initializeMatches } from './matchUtils';

export const loadPlayers = async (): Promise<{
  femalePlayers: Player[];
  malePlayers: Player[];
}> => {
  console.log('Loading players...');

  const { data: players, error } = await supabase
    .from('players')
    .select('*')
    .order('points', { ascending: false })
    .order('total_scores', { ascending: false });

  if (error || !players) {
    console.error('Error loading players:', error);
    return { femalePlayers: [], malePlayers: [] };
  }

  if (players.length === 0) {
    console.log('No players found. Initializing default players...');
    await initializeDefaultPlayers();
    return { femalePlayers: [], malePlayers: [] };
  }

  const formattedPlayers: Player[] = players.map((p: any) => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    points: p.points,
    total_scores: p.total_scores,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const femalePlayers = formattedPlayers.filter(p => p.gender === 'female');
  const malePlayers = formattedPlayers.filter(p => p.gender === 'male');

  console.log(`Loaded ${femalePlayers.length} female and ${malePlayers.length} male players`);

  if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
    console.warn('Expected 8 male and 8 female players. Something may be wrong.');
  }

  return { femalePlayers, malePlayers };
};

export const loadMatches = async (): Promise<{
  femaleMatches: Match[];
  maleMatches: Match[];
}> => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_order', { ascending: true });

  if (error) {
    console.error('Error loading matches:', error);
    return { femaleMatches: [], maleMatches: [] };
  }

  const femaleMatches = matches.filter(match => match.gender === 'female');
  const maleMatches = matches.filter(match => match.gender === 'male');

  return { femaleMatches, maleMatches };
};

export const loadFinalMatch = async (): Promise<FinalMatch | null> => {
  const { data, error } = await supabase
    .from('final_matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error loading final match:', error);
    return null;
  }

  return data;
};

export const resetAllData = async () => {
  console.log('Resetting all tournament data...');

  try {
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    await initializeDefaultPlayers();
    await initializeMatches();

    console.log('Tournament reset complete.');
  } catch (error) {
    console.error('Error resetting tournament data:', error);
  }
};

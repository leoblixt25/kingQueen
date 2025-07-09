import { supabase } from '@/integrations/supabase/client';
import { Gender, Match, Player, FinalMatch } from '@/types';

export const loadPlayers = async (): Promise<{
  femalePlayers: Player[];
  malePlayers: Player[];
}> => {
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, gender, points, total_scores')
    .order('name', { ascending: true });

  if (error || !players) {
    console.error('Error loading players:', error);
    return { femalePlayers: [], malePlayers: [] };
  }

  const formatPlayer = (p: any): Player => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    points: p.points,
    totalScores: p.total_scores,
  });

  const femalePlayers = players
    .filter(p => p.gender === 'female')
    .map(formatPlayer);

  const malePlayers = players
    .filter(p => p.gender === 'male')
    .map(formatPlayer);

  return { femalePlayers, malePlayers };
};

export const loadMatches = async (): Promise<{
  femaleMatches: Match[];
  maleMatches: Match[];
}> => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id,
      gender,
      score1,
      score2,
      is_submitted,
      match_order,
      player1:player1_id (id, name, gender, points, total_scores),
      player2:player2_id (id, name, gender, points, total_scores),
      player3:player3_id (id, name, gender, points, total_scores),
      player4:player4_id (id, name, gender, points, total_scores)
    `)
    .order('match_order', { ascending: true });

  if (error || !matches) {
    console.error('Error loading matches:', error);
    return { femaleMatches: [], maleMatches: [] };
  }

  const formatMatch = (m: any): Match => ({
    id: m.id,
    gender: m.gender,
    score1: m.score1,
    score2: m.score2,
    isSubmitted: m.is_submitted,
    player1: {
      id: m.player1.id,
      name: m.player1.name,
      gender: m.player1.gender,
      points: m.player1.points,
      totalScores: m.player1.total_scores,
    },
    player2: {
      id: m.player2.id,
      name: m.player2.name,
      gender: m.player2.gender,
      points: m.player2.points,
      totalScores: m.player2.total_scores,
    },
    player3: {
      id: m.player3.id,
      name: m.player3.name,
      gender: m.player3.gender,
      points: m.player3.points,
      totalScores: m.player3.total_scores,
    },
    player4: {
      id: m.player4.id,
      name: m.player4.name,
      gender: m.player4.gender,
      points: m.player4.points,
      totalScores: m.player4.total_scores,
    },
  });

  const femaleMatches = matches.filter(m => m.gender === 'female').map(formatMatch);
  const maleMatches = matches.filter(m => m.gender === 'male').map(formatMatch);

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

export const resetAllData = async (): Promise<void> => {
  try {
    console.log('Resetting all data...');
    await Promise.all([
      supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('players').update({ points: 0, total_scores: 0 }),
      supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);
    console.log('Data reset successfully');
  } catch (error) {
    console.error('Error resetting data:', error);
  }
};

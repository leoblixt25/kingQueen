
import { supabase } from '@/integrations/supabase/client';
import { initializePlayers, initializeMatches as initSimpleMatches } from './simpleTournamentUtils';

export const loadPlayers = async () => {
  console.log('Loading players...');
  const { data: players, error } = await supabase
    .from('players')
    .select('*')
    .order('points', { ascending: false })
    .order('total_scores', { ascending: false });

  if (error) {
    console.error('Error loading players:', error);
    return { femalePlayers: [], malePlayers: [] };
  }

  console.log('Players loaded:', players);

  if (players && players.length > 0) {
    const females = players.filter(p => p.gender === 'female').map(p => ({
      name: p.name,
      points: p.points,
      totalScores: p.total_scores
    }));
    
    const males = players.filter(p => p.gender === 'male').map(p => ({
      name: p.name,
      points: p.points,
      totalScores: p.total_scores
    }));

    console.log('Female players count:', females.length);
    console.log('Male players count:', males.length);

    // Check if we have the wrong number of players and need to reinitialize
    if (females.length !== 8 || males.length !== 8) {
      console.log('Incorrect player count detected. Female:', females.length, 'Male:', males.length, '. Reinitializing...');
      await initializePlayers();
      return { femalePlayers: [], malePlayers: [] };
    }

    return { femalePlayers: females, malePlayers: males };
  } else {
    console.log('No players found, initializing players...');
    await initializePlayers();
    return { femalePlayers: [], malePlayers: [] };
  }
};

export const loadMatches = async () => {
  console.log('Loading matches...');
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      *,
      player1:players!matches_player1_id_fkey(name),
      player2:players!matches_player2_id_fkey(name),
      player3:players!matches_player3_id_fkey(name),
      player4:players!matches_player4_id_fkey(name)
    `)
    .order('match_order');

  if (error) {
    console.error('Error loading matches:', error);
    return { femaleMatches: [], maleMatches: [] };
  }

  console.log('Matches loaded:', matches);

  if (matches && matches.length > 0) {
    const femaleMatchesData = matches
      .filter(m => m.gender === 'female')
      .map(m => ({
        id: m.id,
        player1: { name: m.player1?.name || '', points: 0, totalScores: 0 },
        player2: { name: m.player2?.name || '', points: 0, totalScores: 0 },
        player3: { name: m.player3?.name || '', points: 0, totalScores: 0 },
        player4: { name: m.player4?.name || '', points: 0, totalScores: 0 },
        score1: m.score1 || 0,
        score2: m.score2 || 0,
        isSubmitted: m.is_submitted || false
      }));

    const maleMatchesData = matches
      .filter(m => m.gender === 'male')
      .map(m => ({
        id: m.id,
        player1: { name: m.player1?.name || '', points: 0, totalScores: 0 },
        player2: { name: m.player2?.name || '', points: 0, totalScores: 0 },
        player3: { name: m.player3?.name || '', points: 0, totalScores: 0 },
        player4: { name: m.player4?.name || '', points: 0, totalScores: 0 },
        score1: m.score1 || 0,
        score2: m.score2 || 0,
        isSubmitted: m.is_submitted || false
      }));

    console.log('Female matches count:', femaleMatchesData.length);
    console.log('Male matches count:', maleMatchesData.length);

    // Check if we have the wrong number of matches and need to reinitialize
    if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
      console.log('Incorrect match count detected. Female:', femaleMatchesData.length, 'Male:', maleMatchesData.length, '. Reinitializing...');
      await initSimpleMatches();
      return { femaleMatches: [], maleMatches: [] };
    }

    return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };
  } else {
    console.log('No matches found, will initialize after players are created');
    return { femaleMatches: [], maleMatches: [] };
  }
};

export const loadFinalMatch = async () => {
  console.log('Loading final match...');
  const { data: finalMatch, error } = await supabase
    .from('final_matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error loading final match:', error);
    return null;
  }

  return finalMatch;
};

// This function is now deprecated - use fullTournamentReset from simpleTournamentUtils instead

// This function is now deprecated - use fullTournamentReset from simpleTournamentUtils instead

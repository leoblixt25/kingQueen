
import { supabase } from '@/integrations/supabase/client';

// Define match combinations (exactly 14 matches)
export const MATCH_COMBINATIONS = [
  [0, 1, 2, 3], [4, 5, 6, 7], [5, 6, 7, 0], [3, 4, 1, 2],
  [6, 3, 4, 1], [0, 2, 7, 5], [2, 4, 3, 7], [1, 6, 5, 0],
  [5, 3, 6, 2], [7, 1, 0, 4], [2, 7, 1, 5], [3, 0, 4, 6],
  [7, 4, 0, 6], [5, 2, 6, 1]
];

export const initializeMatches = async () => {
  console.log('Initializing matches...');
  
  // Get players to create matches
  const { data: players, error } = await supabase.from('players').select('*');
  if (error || !players) {
    console.error('Error fetching players for match initialization:', error);
    return;
  }

  console.log('Players for match initialization:', players);

  const femalePlayers = players.filter(p => p.gender === 'female');
  const malePlayers = players.filter(p => p.gender === 'male');

  console.log('Female players for matches:', femalePlayers.length);
  console.log('Male players for matches:', malePlayers.length);

  if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
    console.error('Incorrect number of players for match creation. Female:', femalePlayers.length, 'Male:', malePlayers.length);
    return;
  }

  // Check if matches already exist to prevent duplicates
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id');

  if (existingMatches && existingMatches.length > 0) {
    console.log('Matches already exist, skipping initialization');
    return;
  }

  try {
    // Create female matches
    const femaleMatches = MATCH_COMBINATIONS.map((combination, index) => {
      const [p1, p2, p3, p4] = combination;
      return {
        player1_id: femalePlayers[p1].id,
        player2_id: femalePlayers[p2].id,
        player3_id: femalePlayers[p3].id,
        player4_id: femalePlayers[p4].id,
        gender: 'female',
        match_order: index,
        score1: 0,
        score2: 0,
        is_submitted: false
      };
    });

    const { error: femaleMatchError } = await supabase
      .from('matches')
      .insert(femaleMatches);

    if (femaleMatchError) {
      console.error('Error inserting female matches:', femaleMatchError);
      return;
    }

    // Create male matches
    const maleMatches = MATCH_COMBINATIONS.map((combination, index) => {
      const [p1, p2, p3, p4] = combination;
      return {
        player1_id: malePlayers[p1].id,
        player2_id: malePlayers[p2].id,
        player3_id: malePlayers[p3].id,
        player4_id: malePlayers[p4].id,
        gender: 'male',
        match_order: index,
        score1: 0,
        score2: 0,
        is_submitted: false
      };
    });

    const { error: maleMatchError } = await supabase
      .from('matches')
      .insert(maleMatches);

    if (maleMatchError) {
      console.error('Error inserting male matches:', maleMatchError);
      return;
    }

    console.log('Matches initialized successfully - 14 female and 14 male matches');
    
  } catch (error) {
    console.error('Error in initializeMatches:', error);
  }
};

export const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female') => {
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('gender', gender)
    .order('match_order');

  if (!matches || matchIndex >= matches.length) return;

  const matchId = matches[matchIndex].id;

  const { error } = await supabase
    .from('matches')
    .update({
      score1,
      score2,
      is_submitted: true
    })
    .eq('id', matchId);

  if (error) {
    console.error('Error updating match:', error);
    return;
  }

  return matchId;
};

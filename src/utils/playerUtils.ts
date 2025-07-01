
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_FEMALE_PLAYERS = [
  "Lakota", "Lidia", "Giulia", "Dina", "Catalina", "Izel", "Marta", "Eli"
];

export const DEFAULT_MALE_PLAYERS = [
  "Giacomo", "David", "Javi", "Mauro", "Mattia", "Dani", "Leo", "Samuel"
];

export const initializeDefaultPlayers = async () => {
  console.log('Initializing default players...');
  
  try {
    // Check if players already exist to prevent duplicates
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('name, gender');

    if (existingPlayers && existingPlayers.length > 0) {
      console.log('Players already exist, skipping initialization');
      return;
    }

    // Insert female players
    const femaleInserts = DEFAULT_FEMALE_PLAYERS.map(name => ({
      name,
      gender: 'female',
      points: 0,
      total_scores: 0
    }));

    const { error: femaleError } = await supabase
      .from('players')
      .insert(femaleInserts);

    if (femaleError) {
      console.error('Error inserting female players:', femaleError);
      return;
    }

    // Insert male players
    const maleInserts = DEFAULT_MALE_PLAYERS.map(name => ({
      name,
      gender: 'male',
      points: 0,
      total_scores: 0
    }));

    const { error: maleError } = await supabase
      .from('players')
      .insert(maleInserts);

    if (maleError) {
      console.error('Error inserting male players:', maleError);
      return;
    }

    console.log('Default players inserted successfully');
    
  } catch (error) {
    console.error('Error in initializeDefaultPlayers:', error);
  }
};

export const updatePlayerPointsFromMatch = async (matchId: string, score1: number, score2: number) => {
  console.log(`Updating player points for match ${matchId}: score1=${score1}, score2=${score2}`);
  
  try {
    // Get match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('player1_id, player2_id, player3_id, player4_id')
      .eq('id', matchId)
      .single();

    if (matchError) {
      console.error('Error fetching match for points update:', matchError);
      return;
    }

    if (!match) {
      console.error('Match not found for points update:', matchId);
      return;
    }

    console.log('Match details for points update:', match);

    const winnerPoints = 2;
    const loserPoints = 1;

    // Get current player data
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, points, total_scores')
      .in('id', [match.player1_id, match.player2_id, match.player3_id, match.player4_id]);

    if (playersError) {
      console.error('Error fetching players for points update:', playersError);
      return;
    }

    if (!players || players.length !== 4) {
      console.error('Could not fetch all 4 players for points update');
      return;
    }

    console.log('Current player data:', players);

    // Create a map for easier lookup
    const playerMap = players.reduce((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {} as Record<string, any>);

    // Determine winners and update points
    if (score1 > score2) {
      // Team 1 wins (player1 & player2)
      console.log('Team 1 wins');
      
      const player1 = playerMap[match.player1_id];
      const player2 = playerMap[match.player2_id];
      const player3 = playerMap[match.player3_id];
      const player4 = playerMap[match.player4_id];

      // Update winners
      await Promise.all([
        supabase
          .from('players')
          .update({ 
            points: player1.points + winnerPoints,
            total_scores: player1.total_scores + score1
          })
          .eq('id', match.player1_id),
        
        supabase
          .from('players')
          .update({ 
            points: player2.points + winnerPoints,
            total_scores: player2.total_scores + score1
          })
          .eq('id', match.player2_id),
        
        // Update losers
        supabase
          .from('players')
          .update({ 
            points: player3.points + loserPoints,
            total_scores: player3.total_scores + score2
          })
          .eq('id', match.player3_id),
        
        supabase
          .from('players')
          .update({ 
            points: player4.points + loserPoints,
            total_scores: player4.total_scores + score2
          })
          .eq('id', match.player4_id)
      ]);
    } else {
      // Team 2 wins (player3 & player4)
      console.log('Team 2 wins');
      
      const player1 = playerMap[match.player1_id];
      const player2 = playerMap[match.player2_id];
      const player3 = playerMap[match.player3_id];
      const player4 = playerMap[match.player4_id];

      // Update winners
      await Promise.all([
        supabase
          .from('players')
          .update({ 
            points: player3.points + winnerPoints,
            total_scores: player3.total_scores + score2
          })
          .eq('id', match.player3_id),
        
        supabase
          .from('players')
          .update({ 
            points: player4.points + winnerPoints,
            total_scores: player4.total_scores + score2
          })
          .eq('id', match.player4_id),
        
        // Update losers
        supabase
          .from('players')
          .update({ 
            points: player1.points + loserPoints,
            total_scores: player1.total_scores + score1
          })
          .eq('id', match.player1_id),
        
        supabase
          .from('players')
          .update({ 
            points: player2.points + loserPoints,
            total_scores: player2.total_scores + score1
          })
          .eq('id', match.player2_id)
      ]);
    }

    console.log('Player points updated successfully');
  } catch (error) {
    console.error('Unexpected error in updatePlayerPointsFromMatch:', error);
  }
};

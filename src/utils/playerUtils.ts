
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_FEMALE_PLAYERS = [
  "Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8"
];

export const DEFAULT_MALE_PLAYERS = [
  "Player 9", "Player 10", "Player 11", "Player 12", "Player 13", "Player 14", "Player 15", "Player 16"
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

export const updatePlayerPointsFromMatch = async (matchId: string, score1: number, score2: number, isEdit: boolean = false) => {
  console.log(`Updating player points for match ${matchId}: score1=${score1}, score2=${score2}, isEdit=${isEdit}`);
  
  try {
    // Get match details including previous scores if editing
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('player1_id, player2_id, player3_id, player4_id, score1, score2, is_submitted')
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

    let player1NewPoints = playerMap[match.player1_id].points;
    let player2NewPoints = playerMap[match.player2_id].points;
    let player3NewPoints = playerMap[match.player3_id].points;
    let player4NewPoints = playerMap[match.player4_id].points;
    let player1NewScores = playerMap[match.player1_id].total_scores;
    let player2NewScores = playerMap[match.player2_id].total_scores;
    let player3NewScores = playerMap[match.player3_id].total_scores;
    let player4NewScores = playerMap[match.player4_id].total_scores;

    // If editing, first subtract the previous points and scores
    if (isEdit && match.is_submitted) {
      console.log('Editing match - removing previous points and scores');
      
      if (match.score1 > match.score2) {
        // Previous team 1 win - subtract those points
        player1NewPoints -= winnerPoints;
        player2NewPoints -= winnerPoints;
        player3NewPoints -= loserPoints;
        player4NewPoints -= loserPoints;
        player1NewScores -= match.score1;
        player2NewScores -= match.score1;
        player3NewScores -= match.score2;
        player4NewScores -= match.score2;
      } else {
        // Previous team 2 win - subtract those points
        player1NewPoints -= loserPoints;
        player2NewPoints -= loserPoints;
        player3NewPoints -= winnerPoints;
        player4NewPoints -= winnerPoints;
        player1NewScores -= match.score1;
        player2NewScores -= match.score1;
        player3NewScores -= match.score2;
        player4NewScores -= match.score2;
      }
    }

    // Now add the new points and scores
    if (score1 > score2) {
      // Team 1 wins (player1 & player2)
      console.log('Team 1 wins');
      player1NewPoints += winnerPoints;
      player2NewPoints += winnerPoints;
      player3NewPoints += loserPoints;
      player4NewPoints += loserPoints;
      player1NewScores += score1;
      player2NewScores += score1;
      player3NewScores += score2;
      player4NewScores += score2;
    } else {
      // Team 2 wins (player3 & player4)
      console.log('Team 2 wins');
      player1NewPoints += loserPoints;
      player2NewPoints += loserPoints;
      player3NewPoints += winnerPoints;
      player4NewPoints += winnerPoints;
      player1NewScores += score1;
      player2NewScores += score1;
      player3NewScores += score2;
      player4NewScores += score2;
    }

    // Update all players with final values
    await Promise.all([
      supabase
        .from('players')
        .update({ 
          points: player1NewPoints,
          total_scores: player1NewScores
        })
        .eq('id', match.player1_id),
      
      supabase
        .from('players')
        .update({ 
          points: player2NewPoints,
          total_scores: player2NewScores
        })
        .eq('id', match.player2_id),
      
      supabase
        .from('players')
        .update({ 
          points: player3NewPoints,
          total_scores: player3NewScores
        })
        .eq('id', match.player3_id),
      
      supabase
        .from('players')
        .update({ 
          points: player4NewPoints,
          total_scores: player4NewScores
        })
        .eq('id', match.player4_id)
    ]);

    console.log('Player points updated successfully');
  } catch (error) {
    console.error('Unexpected error in updatePlayerPointsFromMatch:', error);
  }
};

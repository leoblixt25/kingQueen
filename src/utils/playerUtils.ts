
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
  const { data: match } = await supabase
    .from('matches')
    .select('player1_id, player2_id, player3_id, player4_id')
    .eq('id', matchId)
    .single();

  if (!match) return;

  const winnerPoints = 2;
  const loserPoints = 1;

  // Get current player data to calculate new values
  const { data: player1 } = await supabase.from('players').select('points, total_scores').eq('id', match.player1_id).single();
  const { data: player2 } = await supabase.from('players').select('points, total_scores').eq('id', match.player2_id).single();
  const { data: player3 } = await supabase.from('players').select('points, total_scores').eq('id', match.player3_id).single();
  const { data: player4 } = await supabase.from('players').select('points, total_scores').eq('id', match.player4_id).single();

  if (score1 > score2) {
    // Team 1 wins
    if (player1) {
      await supabase
        .from('players')
        .update({ 
          points: player1.points + winnerPoints,
          total_scores: player1.total_scores + score1
        })
        .eq('id', match.player1_id);
    }
    
    if (player2) {
      await supabase
        .from('players')
        .update({ 
          points: player2.points + winnerPoints,
          total_scores: player2.total_scores + score1
        })
        .eq('id', match.player2_id);
    }
    
    if (player3) {
      await supabase
        .from('players')
        .update({ 
          points: player3.points + loserPoints,
          total_scores: player3.total_scores + score2
        })
        .eq('id', match.player3_id);
    }
    
    if (player4) {
      await supabase
        .from('players')
        .update({ 
          points: player4.points + loserPoints,
          total_scores: player4.total_scores + score2
        })
        .eq('id', match.player4_id);
    }
  } else {
    // Team 2 wins
    if (player1) {
      await supabase
        .from('players')
        .update({ 
          points: player1.points + loserPoints,
          total_scores: player1.total_scores + score1
        })
        .eq('id', match.player1_id);
    }
    
    if (player2) {
      await supabase
        .from('players')
        .update({ 
          points: player2.points + loserPoints,
          total_scores: player2.total_scores + score1
        })
        .eq('id', match.player2_id);
    }
    
    if (player3) {
      await supabase
        .from('players')
        .update({ 
          points: player3.points + winnerPoints,
          total_scores: player3.total_scores + score2
        })
        .eq('id', match.player3_id);
    }
    
    if (player4) {
      await supabase
        .from('players')
        .update({ 
          points: player4.points + winnerPoints,
          total_scores: player4.total_scores + score2
        })
        .eq('id', match.player4_id);
    }
  }
};

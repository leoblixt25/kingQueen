import { supabase } from '@/integrations/supabase/client';
import { STATIC_MATCHUPS, FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize players using static names
 */
export const initializePlayers = async () => {
  console.log('Initializing players with static names...');
  
  try {
    // Check if players already exist
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id');

    if (existingPlayers && existingPlayers.length > 0) {
      console.log('Players already exist, skipping initialization');
      return;
    }

    // Insert female players
    const femaleInserts = FEMALE_PLAYERS.map(name => ({
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
      throw femaleError;
    }

    // Insert male players
    const maleInserts = MALE_PLAYERS.map(name => ({
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
      throw maleError;
    }

    console.log('Players initialized successfully');
  } catch (error) {
    console.error('Error in initializePlayers:', error);
    throw error;
  }
};

/**
 * Initialize matches using static matchups
 */
export const initializeMatches = async () => {
  console.log('Initializing matches with static matchups...');
  
  try {
    // Check if matches already exist
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id');

    if (existingMatches && existingMatches.length > 0) {
      console.log('Matches already exist, skipping initialization');
      return;
    }

    // Get players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('gender')
      .order('name');

    if (playersError || !players) {
      console.error('Error fetching players:', playersError);
      throw playersError;
    }

    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');

    if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
      throw new Error(`Expected 8 players of each gender, got ${femalePlayers.length} female and ${malePlayers.length} male`);
    }

    // Create female matches
    const femaleMatches = STATIC_MATCHUPS.map((matchup, index) => {
      const [p1, p2, p3, p4] = matchup;
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

    // Create male matches
    const maleMatches = STATIC_MATCHUPS.map((matchup, index) => {
      const [p1, p2, p3, p4] = matchup;
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

    // Insert all matches
    const { error: matchesError } = await supabase
      .from('matches')
      .insert([...femaleMatches, ...maleMatches]);

    if (matchesError) {
      console.error('Error inserting matches:', matchesError);
      throw matchesError;
    }

    console.log('Matches initialized successfully');
  } catch (error) {
    console.error('Error in initializeMatches:', error);
    throw error;
  }
};

/**
 * Reset scores only - keeps players and match structure
 */
export const resetScoresOnly = async () => {
  console.log('Resetting scores only...');
  
  try {
    // Reset all player points and total scores
    const { error: playersError } = await supabase
      .from('players')
      .update({ points: 0, total_scores: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (playersError) {
      console.error('Error resetting player scores:', playersError);
      throw playersError;
    }

    // Reset all match scores
    const { error: matchesError } = await supabase
      .from('matches')
      .update({ score1: 0, score2: 0, is_submitted: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (matchesError) {
      console.error('Error resetting match scores:', matchesError);
      throw matchesError;
    }

    // Reset final match
    const { error: finalError } = await supabase
      .from('final_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (finalError) {
      console.error('Error resetting final match:', finalError);
      throw finalError;
    }

    console.log('Scores reset successfully');
  } catch (error) {
    console.error('Error in resetScoresOnly:', error);
    throw error;
  }
};

/**
 * Replace a single player name without affecting match structure
 */
export const replacePlayerName = async (oldName: string, newName: string, gender: 'male' | 'female') => {
  console.log(`Replacing player: ${oldName} -> ${newName} (${gender})`);
  
  try {
    const { error } = await supabase
      .from('players')
      .update({ name: newName })
      .eq('name', oldName)
      .eq('gender', gender);

    if (error) {
      console.error('Error replacing player name:', error);
      throw error;
    }

    console.log('Player name replaced successfully');
  } catch (error) {
    console.error('Error in replacePlayerName:', error);
    throw error;
  }
};

/**
 * Complete tournament reset - deletes everything and reinitializes
 */
export const fullTournamentReset = async () => {
  console.log('Performing full tournament reset...');
  
  try {
    // Delete in correct order (foreign key constraints)
    await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Wait for deletions to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize
    await initializePlayers();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await initializeMatches();
    
    console.log('Full tournament reset completed');
  } catch (error) {
    console.error('Error in fullTournamentReset:', error);
    throw error;
  }
};
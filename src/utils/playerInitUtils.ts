import { supabase } from '@/integrations/supabase/client';
import { FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

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

    // Insert female players as placeholders
    const femaleInserts = FEMALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'female',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
    }));

    const { error: femaleError } = await supabase
      .from('players')
      .insert(femaleInserts);

    if (femaleError) {
      console.error('Error inserting female players:', femaleError);
      throw femaleError;
    }

    // Insert male players as placeholders
    const maleInserts = MALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'male',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
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
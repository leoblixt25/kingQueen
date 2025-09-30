import { supabase } from '@/integrations/supabase/client';

/**
 * Reset all players to placeholder names and unconfirmed status
 * This will prepare the database for the new registration system
 */
export const resetPlayersToPlaceholders = async () => {
  console.log('Resetting players to placeholder names...');
  
  try {
    // First, ensure we have 8 placeholder players for each gender
    const placeholderPlayers = [];
    
    // Create female placeholder players
    for (let i = 1; i <= 8; i++) {
      placeholderPlayers.push({
        name: `Female Player ${i}`,
        gender: 'female',
        position: i,
        points: 0,
        total_scores: 0,
        matches_played: 0,
        is_confirmed: false,
        email: null,
        registered_at: null
      });
    }
    
    // Create male placeholder players
    for (let i = 1; i <= 8; i++) {
      placeholderPlayers.push({
        name: `Male Player ${i}`,
        gender: 'male',
        position: i,
        points: 0,
        total_scores: 0,
        matches_played: 0,
        is_confirmed: false,
        email: null,
        registered_at: null
      });
    }

    // Delete all existing players first
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting existing players:', deleteError);
      throw deleteError;
    }

    // Insert new placeholder players
    const { error: insertError } = await supabase
      .from('players')
      .insert(placeholderPlayers);

    if (insertError) {
      console.error('Error inserting placeholder players:', insertError);
      throw insertError;
    }

    console.log('✅ Successfully reset players to placeholders');
    return true;

  } catch (error) {
    console.error('❌ Error resetting players to placeholders:', error);
    throw error;
  }
};

/**
 * Get the next available placeholder slot for a gender
 */
export const getNextAvailablePlaceholder = async (gender: 'male' | 'female') => {
  try {
    const placeholderPrefix = gender === 'male' ? 'Male Player' : 'Female Player';
    
    const { data: availableSlot, error } = await supabase
      .from('players')
      .select('id, name, position')
      .eq('gender', gender)
      .ilike('name', `${placeholderPrefix}%`)
      .eq('is_confirmed', false)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error finding available placeholder:', error);
      throw error;
    }

    return availableSlot;
  } catch (error) {
    console.error('Error in getNextAvailablePlaceholder:', error);
    throw error;
  }
};

/**
 * Register a player by replacing a placeholder
 */
export const registerPlayerToSlot = async (
  name: string, 
  email: string, 
  gender: 'male' | 'female'
) => {
  try {
    // Check if email already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingPlayer) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Find next available placeholder
    const placeholder = await getNextAvailablePlaceholder(gender);
    
    if (!placeholder) {
      throw new Error('NO_SLOTS_AVAILABLE');
    }

    // Update the placeholder with real player info
    const { error } = await supabase
      .from('players')
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        is_confirmed: true,
        registered_at: new Date().toISOString()
      })
      .eq('id', placeholder.id);

    if (error) {
      console.error('Error updating placeholder:', error);
      throw error;
    }

    console.log(`✅ Successfully registered ${name} to position ${placeholder.position}`);
    return {
      success: true,
      position: placeholder.position,
      playerId: placeholder.id
    };

  } catch (error) {
    console.error('Error in registerPlayerToSlot:', error);
    throw error;
  }
};

/**
 * Unregister a player by converting back to placeholder
 */
export const unregisterPlayer = async (email: string) => {
  try {
    // Find the confirmed player
    const { data: player, error: findError } = await supabase
      .from('players')
      .select('id, name, gender, position')
      .eq('email', email.toLowerCase())
      .eq('is_confirmed', true)
      .single();

    if (findError || !player) {
      throw new Error('PLAYER_NOT_FOUND');
    }

    // Convert back to placeholder
    const placeholderName = player.gender === 'male' 
      ? `Male Player ${player.position}` 
      : `Female Player ${player.position}`;

    const { error } = await supabase
      .from('players')
      .update({
        name: placeholderName,
        email: null,
        is_confirmed: false,
        registered_at: null,
        points: 0,
        total_scores: 0,
        matches_played: 0
      })
      .eq('id', player.id);

    if (error) {
      console.error('Error converting player back to placeholder:', error);
      throw error;
    }

    console.log(`✅ Successfully unregistered ${player.name} from position ${player.position}`);
    return true;

  } catch (error) {
    console.error('Error in unregisterPlayer:', error);
    throw error;
  }
};
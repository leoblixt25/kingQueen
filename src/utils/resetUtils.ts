import { supabase } from '@/integrations/supabase/client';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches } from './matchInitUtils';

/**
 * Reset scores only - keeps players and match structure
 */
export const resetScoresOnly = async () => {
  console.log('Resetting scores only...');
  
  try {
    // Execute all resets in parallel for better performance
    const [playersResult, matchesResult, finalResult] = await Promise.allSettled([
      // Reset all player points and total scores
      supabase
        .from('players')
        .update({ points: 0, total_scores: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000'),
      
      // Reset all match scores
      supabase
        .from('matches')
        .update({ score1: 0, score2: 0, is_completed: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'),
      
      // Reset final match
      supabase
        .from('final_matches')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    ]);

    // Check for errors
    if (playersResult.status === 'rejected') {
      console.error('Error resetting player scores:', playersResult.reason);
      throw playersResult.reason;
    }
    if (matchesResult.status === 'rejected') {
      console.error('Error resetting match scores:', matchesResult.reason);
      throw matchesResult.reason;
    }
    if (finalResult.status === 'rejected') {
      console.error('Error resetting final match:', finalResult.reason);
      throw finalResult.reason;
    }

    console.log('Scores reset successfully');
  } catch (error) {
    console.error('Error in resetScoresOnly:', error);
    throw error;
  }
};

/**
 * Complete tournament reset - deletes everything and reinitializes
 */
export const fullTournamentReset = async () => {
  console.log('Performing full tournament reset...');
  
  try {
    // Delete in correct order (foreign key constraints) - execute in parallel where possible
    await Promise.all([
      supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);
    
    // Delete players after matches are deleted (foreign key constraint)
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Minimal wait for database consistency
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reinitialize players first
    await initializePlayers();
    
    // Brief pause for player creation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then initialize matches
    await initializeMatches();
    
    console.log('Full tournament reset completed');
  } catch (error) {
    console.error('Error in fullTournamentReset:', error);
    throw error;
  }
};
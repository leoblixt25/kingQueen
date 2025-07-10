import { supabase } from '@/lib/supabase';
import { FIXED_PLAYERS, MATCH_COMBINATIONS, Gender } from '@/lib/constants';
import { Player, Match } from '@/types';

/**
 * Initialize tournament with fixed players and matches
 */
export async function initializeTournament() {
  console.log('🏐 Initializing tournament...');
  
  try {
    // Check if already initialized
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id')
      .limit(1);
    
    if (existingPlayers && existingPlayers.length > 0) {
      console.log('⚠️ Tournament already initialized');
      return { success: true, message: 'Tournament already exists' };
    }
    
    // Insert fixed players
    await insertFixedPlayers();
    await insertFixedMatches();
    
    console.log('✅ Tournament initialized successfully');
    return { success: true, message: 'Tournament initialized' };
    
  } catch (error) {
    console.error('❌ Failed to initialize tournament:', error);
    return { success: false, error };
  }
}

/**
 * Insert fixed players with predefined UUIDs
 */
async function insertFixedPlayers() {
  const allPlayers = [
    ...FIXED_PLAYERS.male.map(p => ({
      id: p.uuid,
      name: p.name,
      gender: 'male' as const,
      position: p.position,
    })),
    ...FIXED_PLAYERS.female.map(p => ({
      id: p.uuid,
      name: p.name,
      gender: 'female' as const,
      position: p.position,
    })),
  ];
  
  const { error } = await supabase
    .from('players')
    .insert(allPlayers);
    
  if (error) throw error;
  console.log('✅ Fixed players inserted');
}

/**
 * Insert fixed match combinations
 */
async function insertFixedMatches() {
  const malePlayerIds = FIXED_PLAYERS.male.map(p => p.uuid);
  const femalePlayerIds = FIXED_PLAYERS.female.map(p => p.uuid);
  
  const allMatches = [];
  
  // Create male matches
  MATCH_COMBINATIONS.forEach((combination, index) => {
    allMatches.push({
      gender: 'male',
      match_number: index + 1,
      player1_id: malePlayerIds[combination[0]],
      player2_id: malePlayerIds[combination[1]],
      player3_id: malePlayerIds[combination[2]],
      player4_id: malePlayerIds[combination[3]],
    });
  });
  
  // Create female matches
  MATCH_COMBINATIONS.forEach((combination, index) => {
    allMatches.push({
      gender: 'female',
      match_number: index + 1,
      player1_id: femalePlayerIds[combination[0]],
      player2_id: femalePlayerIds[combination[1]],
      player3_id: femalePlayerIds[combination[2]],
      player4_id: femalePlayerIds[combination[3]],
    });
  });
  
  const { error } = await supabase
    .from('matches')
    .insert(allMatches);
    
  if (error) throw error;
  console.log('✅ Fixed matches inserted');
}

/**
 * Reset all scores but keep players and match structure
 */
export async function resetTournamentScores() {
  console.log('🔄 Resetting tournament scores...');
  
  try {
    // Reset match scores
    const { error: matchError } = await supabase
      .from('matches')
      .update({
        score1: 0,
        score2: 0,
        is_completed: false,
        completed_at: null,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    
    if (matchError) throw matchError;
    
    // Reset player stats
    const { error: playerError } = await supabase
      .from('players')
      .update({
        points: 0,
        total_scores: 0,
        matches_played: 0,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    
    if (playerError) throw playerError;
    
    // Reset final match
    const { error: finalError } = await supabase
      .from('final_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (finalError) throw finalError;
    
    console.log('✅ Tournament scores reset successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to reset scores:', error);
    return { success: false, error };
  }
}

/**
 * Update match score and trigger recalculation
 */
export async function updateMatchScore(matchId: string, score1: number, score2: number) {
  console.log(`🏐 Updating match ${matchId}: ${score1} - ${score2}`);
  
  try {
    const { error } = await supabase
      .from('matches')
      .update({
        score1,
        score2,
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', matchId);
    
    if (error) throw error;
    
    console.log('✅ Match score updated successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to update match score:', error);
    return { success: false, error };
  }
}

/**
 * Create final match with top players
 */
export async function createFinalMatch(
  maleKingId: string,
  femaleQueenId: string,
  malePrinceId: string,
  femalePrincessId: string
) {
  console.log('👑 Creating final match...');
  
  try {
    // Delete existing final match
    await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Create new final match
    const { error } = await supabase
      .from('final_matches')
      .insert({
        male_king_id: maleKingId,
        female_queen_id: femaleQueenId,
        male_prince_id: malePrinceId,
        female_princess_id: femalePrincessId,
      });
    
    if (error) throw error;
    
    console.log('✅ Final match created successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to create final match:', error);
    return { success: false, error };
  }
}
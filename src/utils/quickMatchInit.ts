import { supabase } from '@/integrations/supabase/client';
import { STATIC_MATCHUPS } from './staticMatchups';

/**
 * Quick match initialization for when players are registered but matches are missing
 */
export const quickInitializeMatches = async () => {
  console.log('🏐 Quick Match Initialization...');
  
  try {
    // 1. Check if we have the right number of players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('is_confirmed', true)
      .order('gender')
      .order('position');

    if (playersError) {
      console.error('Error fetching players:', playersError);
      throw playersError;
    }

    console.log('Confirmed players found:', players?.length || 0);

    if (!players || players.length === 0) {
      throw new Error('No confirmed players found. Register some players first!');
    }

    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');

    console.log(`Female players: ${femalePlayers.length}, Male players: ${malePlayers.length}`);

    // 2. Clear any existing matches
    console.log('🧹 Clearing existing matches...');
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error clearing matches:', deleteError);
    }

    // 3. Create matches using confirmed players and remaining placeholders
    const allMatches = [];

    // Create female matches
    if (femalePlayers.length > 0) {
      // Get all female players (confirmed + placeholders) in position order
      const { data: allFemales } = await supabase
        .from('players')
        .select('*')
        .eq('gender', 'female')
        .order('position');

      if (allFemales && allFemales.length >= 4) {
        console.log('Creating female matches...');
        STATIC_MATCHUPS.forEach((matchup, index) => {
          const [p1, p2, p3, p4] = matchup;
          if (allFemales[p1] && allFemales[p2] && allFemales[p3] && allFemales[p4]) {
            allMatches.push({
              player1_id: allFemales[p1].id,
              player2_id: allFemales[p2].id,
              player3_id: allFemales[p3].id,
              player4_id: allFemales[p4].id,
              gender: 'female',
              match_number: index + 1,
              score1: 0,
              score2: 0,
              is_completed: false
            });
          }
        });
      }
    }

    // Create male matches
    if (malePlayers.length > 0) {
      // Get all male players (confirmed + placeholders) in position order
      const { data: allMales } = await supabase
        .from('players')
        .select('*')
        .eq('gender', 'male')
        .order('position');

      if (allMales && allMales.length >= 4) {
        console.log('Creating male matches...');
        STATIC_MATCHUPS.forEach((matchup, index) => {
          const [p1, p2, p3, p4] = matchup;
          if (allMales[p1] && allMales[p2] && allMales[p3] && allMales[p4]) {
            allMatches.push({
              player1_id: allMales[p1].id,
              player2_id: allMales[p2].id,
              player3_id: allMales[p3].id,
              player4_id: allMales[p4].id,
              gender: 'male',
              match_number: index + 1,
              score1: 0,
              score2: 0,
              is_completed: false
            });
          }
        });
      }
    }

    // 4. Insert all matches
    if (allMatches.length > 0) {
      console.log(`🎾 Inserting ${allMatches.length} matches...`);
      const { error: insertError } = await supabase
        .from('matches')
        .insert(allMatches);

      if (insertError) {
        console.error('Error inserting matches:', insertError);
        throw insertError;
      }

      console.log('✅ Matches created successfully!');
    } else {
      console.log('⚠️ No matches could be created - need at least 4 players per gender');
    }

    // 5. Verify matches were created
    const { data: newMatches } = await supabase
      .from('matches')
      .select('*')
      .order('gender')
      .order('match_number');

    console.log('🎉 Match initialization complete!');
    console.log(`📊 Total matches created: ${newMatches?.length || 0}`);
    console.log('🚀 Tournament is ready to begin!');

    return {
      success: true,
      matchesCreated: newMatches?.length || 0,
      femaleMatches: newMatches?.filter(m => m.gender === 'female').length || 0,
      maleMatches: newMatches?.filter(m => m.gender === 'male').length || 0
    };

  } catch (error) {
    console.error('❌ Quick match initialization failed:', error);
    throw error;
  }
};

// Make it globally available
if (typeof window !== 'undefined') {
  (window as any).quickInitializeMatches = quickInitializeMatches;
}
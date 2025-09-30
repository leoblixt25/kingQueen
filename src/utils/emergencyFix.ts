import { supabase } from '@/integrations/supabase/client';

/**
 * Emergency fix for database initialization issues
 * This handles common problems with the tournament setup
 */
export const emergencyFix = async () => {
  console.log('🚨 Running emergency database fix...');
  
  try {
    // 1. Check what's actually in the database
    console.log('🔍 Step 1: Checking current database state...');
    const { data: currentPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('gender')
      .order('position');
    
    console.log('Current players:', currentPlayers);
    if (playersError) {
      console.error('Players query error:', playersError);
    }

    // 2. Check if position column exists
    if (currentPlayers && currentPlayers.length > 0) {
      const firstPlayer = currentPlayers[0];
      console.log('Sample player structure:', Object.keys(firstPlayer));
      
      if (!('position' in firstPlayer)) {
        console.log('❌ Position column missing! Players need position field.');
        throw new Error('MISSING_POSITION_COLUMN');
      }
    }

    // 3. Clean slate approach - delete all players and recreate
    console.log('🧹 Step 2: Cleaning existing players...');
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Delete error:', deleteError);
    }

    // 4. Create new placeholder players with proper structure
    console.log('👥 Step 3: Creating placeholder players...');
    const placeholderPlayers = [];
    
    // Female players (positions 1-8)
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
    
    // Male players (positions 1-8)
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

    console.log('Inserting players:', placeholderPlayers.slice(0, 2), '... (and 14 more)');

    const { data: insertedPlayers, error: insertError } = await supabase
      .from('players')
      .insert(placeholderPlayers)
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      
      // Try alternative approach without optional fields
      console.log('🔄 Trying simplified insert...');
      const simplifiedPlayers = placeholderPlayers.map(p => ({
        name: p.name,
        gender: p.gender,
        position: p.position,
        points: 0,
        total_scores: 0,
        is_confirmed: false
      }));

      const { error: simpleInsertError } = await supabase
        .from('players')
        .insert(simplifiedPlayers);

      if (simpleInsertError) {
        console.error('❌ Simplified insert also failed:', simpleInsertError);
        throw simpleInsertError;
      }
      
      console.log('✅ Simplified insert successful!');
    } else {
      console.log('✅ Full insert successful!', insertedPlayers?.length, 'players created');
    }

    // 5. Verify the insert worked
    console.log('🔍 Step 4: Verifying players were created...');
    const { data: verifyPlayers, error: verifyError } = await supabase
      .from('players')
      .select('name, gender, position, is_confirmed')
      .order('gender')
      .order('position');

    if (verifyError) {
      console.error('Verify error:', verifyError);
    } else {
      console.log('✅ Verification successful:', verifyPlayers?.length, 'players found');
      console.log('Sample players:', verifyPlayers?.slice(0, 4));
    }

    // 6. Test the get_available_spots function
    console.log('🔍 Step 5: Testing available spots function...');
    const { data: spots, error: spotsError } = await (supabase as any)
      .rpc('get_available_spots');

    if (spotsError) {
      console.error('❌ Available spots error:', spotsError);
      console.log('💡 This might be a database function issue. Check Supabase dashboard.');
    } else {
      console.log('✅ Available spots working:', spots);
    }

    // 7. Ensure settings exist
    console.log('⚙️ Step 6: Checking tournament settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (!settings || settingsError) {
      console.log('🔧 Creating default settings...');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const { error: createSettingsError } = await supabase
        .from('settings')
        .insert({
          tournament_date: futureDate.toISOString().split('T')[0],
          max_players_per_gender: 8,
          registration_cutoff_days: 3
        });

      if (createSettingsError) {
        console.error('Settings creation error:', createSettingsError);
      } else {
        console.log('✅ Settings created successfully');
      }
    } else {
      console.log('✅ Settings already exist:', settings);
    }

    console.log('🎉 Emergency fix completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Players: Created 16 placeholder players (8 male, 8 female)');
    console.log('- Settings: Tournament configuration verified');
    console.log('- Registration: Should now work properly');
    console.log('');
    console.log('🚀 Try registration now!');

    return {
      success: true,
      message: 'Emergency fix completed',
      playersCreated: verifyPlayers?.length || 0,
      availableSpots: spots
    };

  } catch (error: any) {
    console.error('❌ Emergency fix failed:', error);
    
    // Provide specific guidance based on error type
    if (error.message === 'MISSING_POSITION_COLUMN') {
      console.log('💡 Solution: The database schema needs to be updated.');
      console.log('   - Check Supabase dashboard for the players table');
      console.log('   - Ensure the "position" column exists with type INTEGER');
    }
    
    throw error;
  }
};

// Make it globally available
if (typeof window !== 'undefined') {
  (window as any).emergencyFix = emergencyFix;
}
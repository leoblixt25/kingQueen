import { resetPlayersToPlaceholders } from './placeholderUtils';
import { supabase } from '@/integrations/supabase/client';

/**
 * One-time initialization script to set up the tournament with placeholder players.
 * This should be run once to prepare the database for registration.
 */
export const initializeTournamentDatabase = async () => {
  console.log('🏐 Initializing Tournament Database...');
  
  try {
    // 1. Reset all players to placeholders
    console.log('📝 Step 1: Resetting players to placeholders...');
    await resetPlayersToPlaceholders();
    
    // 2. Clear any existing matches to prevent foreign key issues
    console.log('🏐 Step 2: Clearing existing matches...');
    const { error: matchError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (matchError) {
      console.error('Error clearing matches:', matchError);
    }
    
    // 3. Clear final matches
    console.log('🏆 Step 3: Clearing final matches...');
    const { error: finalError } = await supabase
      .from('final_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (finalError) {
      console.error('Error clearing final matches:', finalError);
    }
    
    // 4. Set up tournament settings if they don't exist
    console.log('⚙️ Step 4: Setting up tournament settings...');
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
    
    if (!existingSettings) {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 30); // 30 days from now
      
      const { error: settingsError } = await supabase
        .from('settings')
        .insert({
          tournament_date: tournamentDate.toISOString().split('T')[0],
          max_players_per_gender: 8,
          registration_cutoff_days: 3
        });
      
      if (settingsError) {
        console.error('Error creating settings:', settingsError);
      } else {
        console.log('✅ Tournament settings created');
      }
    } else {
      console.log('✅ Tournament settings already exist');
    }
    
    console.log('🎉 Tournament database initialization complete!');
    console.log('📋 Summary:');
    console.log('   - 8 Female placeholder players (Female Player 1-8)');
    console.log('   - 8 Male placeholder players (Male Player 1-8)');
    console.log('   - All players are unconfirmed and ready for registration');
    console.log('   - Tournament settings configured');
    console.log('');
    console.log('🚀 The tournament is now ready for player registration!');
    
    return {
      success: true,
      message: 'Tournament database initialized successfully'
    };
    
  } catch (error) {
    console.error('❌ Error initializing tournament database:', error);
    throw error;
  }
};

/**
 * Quick check to see current database status
 */
export const checkDatabaseStatus = async () => {
  try {
    const { data: players } = await supabase
      .from('players')
      .select('name, gender, is_confirmed, email')
      .order('gender')
      .order('position');
    
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
    
    console.log('📊 Current Database Status:');
    console.log('Players:', players);
    console.log('Settings:', settings);
    
    const confirmedPlayers = players?.filter(p => p.is_confirmed) || [];
    const maleCount = confirmedPlayers.filter(p => p.gender === 'male').length;
    const femaleCount = confirmedPlayers.filter(p => p.gender === 'female').length;
    
    console.log(`📈 Registration Status:`);
    console.log(`   - Male: ${maleCount}/8 confirmed`);
    console.log(`   - Female: ${femaleCount}/8 confirmed`);
    
    return {
      totalPlayers: players?.length || 0,
      confirmedPlayers: confirmedPlayers.length,
      maleCount,
      femaleCount,
      settings
    };
    
  } catch (error) {
    console.error('Error checking database status:', error);
    throw error;
  }
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).initializeTournamentDatabase = initializeTournamentDatabase;
  (window as any).checkDatabaseStatus = checkDatabaseStatus;
  (window as any).resetPlayersToPlaceholders = resetPlayersToPlaceholders;
}
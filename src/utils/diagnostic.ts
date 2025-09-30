import { supabase } from '@/integrations/supabase/client';

/**
 * Quick database diagnostic and fix
 */
export const diagnosticAndFix = async () => {
  console.log('🔍 Running database diagnostic...');
  
  try {
    // 1. Check current players
    const { data: currentPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('gender')
      .order('position');
    
    console.log('Current players in database:', currentPlayers);
    console.log('Players count:', currentPlayers?.length || 0);
    
    // 2. Check settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
    
    console.log('Settings:', settings);
    
    // 3. Check available spots function
    const { data: spots, error: spotsError } = await (supabase as any)
      .rpc('get_available_spots');
    
    console.log('Available spots:', spots);
    console.log('Spots error:', spotsError);
    
    // 4. If no players or wrong setup, initialize
    if (!currentPlayers || currentPlayers.length === 0 || !currentPlayers.some(p => !p.is_confirmed)) {
      console.log('🔧 No placeholder players found. Initializing...');
      
      // Delete existing players
      await supabase
        .from('players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Create placeholder players
      const placeholderPlayers = [];
      
      // Female players
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
      
      // Male players
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
      
      const { error: insertError } = await supabase
        .from('players')
        .insert(placeholderPlayers);
      
      if (insertError) {
        console.error('Error inserting placeholders:', insertError);
        throw insertError;
      }
      
      console.log('✅ Placeholder players created!');
    }
    
    // 5. Ensure settings exist
    if (!settings) {
      console.log('🔧 No settings found. Creating default settings...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      
      const { error: settingsError } = await supabase
        .from('settings')
        .insert({
          tournament_date: tomorrow.toISOString().split('T')[0],
          max_players_per_gender: 8,
          registration_cutoff_days: 3
        });
      
      if (settingsError) {
        console.error('Error creating settings:', settingsError);
      } else {
        console.log('✅ Settings created!');
      }
    }
    
    // 6. Final check
    const { data: finalSpots } = await (supabase as any)
      .rpc('get_available_spots');
    
    console.log('🎉 Final available spots:', finalSpots);
    console.log('🚀 Database is now ready for registration!');
    
    return {
      success: true,
      spots: finalSpots
    };
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    throw error;
  }
};

// Make it globally available
if (typeof window !== 'undefined') {
  (window as any).diagnosticAndFix = diagnosticAndFix;
}
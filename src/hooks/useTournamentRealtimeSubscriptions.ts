import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeSubscriptionsProps {
  loadPlayersData: () => Promise<void>;
  loadMatchesData: () => Promise<void>;
  loadFinalMatchData: () => Promise<void>;
}

export const useTournamentRealtimeSubscriptions = ({
  loadPlayersData,
  loadMatchesData,
  loadFinalMatchData,
}: UseRealtimeSubscriptionsProps) => {
  useEffect(() => {
    console.log('🔔 Setting up real-time subscriptions...');
    
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
        console.log('🔔 Players table changed - reloading players data', payload);
        loadPlayersData();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        console.log('🔔 Matches table changed - reloading matches data', payload);
        loadMatchesData();
      })
      .subscribe();

    const finalMatchChannel = supabase
      .channel('final-match-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, (payload) => {
        console.log('🔔 Final match table changed - reloading final match data', payload);
        loadFinalMatchData();
      })
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up real-time subscriptions...');
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalMatchChannel);
    };
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData]);
};
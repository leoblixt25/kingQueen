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
        console.log('🔁 Players table changed - reloading data', payload);
        loadPlayersData();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        console.log('🔁 Matches table changed - reloading data', payload);
        loadMatchesData();
      })
      .subscribe();

    const finalMatchChannel = supabase
      .channel('final-match-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, (payload) => {
        console.log('🔁 Final match table changed - reloading data', payload);
        loadFinalMatchData();
      })
      .subscribe();

    const refreshChannel = supabase
      .channel('app-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_refresh' }, (payload) => {
        console.log('♻️ App refresh triggered:', payload);
        window.location.reload(); // Force a full reload of the app
      })
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions...');
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalMatchChannel);
      supabase.removeChannel(refreshChannel);
    };
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData]);
};

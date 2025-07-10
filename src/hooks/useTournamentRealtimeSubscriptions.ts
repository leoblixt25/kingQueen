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
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        console.log('Players table changed - reloading players data');
        loadPlayersData();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatchesData();
      })
      .subscribe();

    const finalMatchChannel = supabase
      .channel('final-match-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, () => {
        loadFinalMatchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalMatchChannel);
    };
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData]);
};
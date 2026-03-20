import { useEffect } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/config/firebase';

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

    // Set up Firestore realtime listeners for each collection
    const playersUnsubscribe = onSnapshot(collection(db, 'players'), () => {
      console.log('🔁 Players collection changed - reloading data');
      loadPlayersData();
    });

    const matchesUnsubscribe = onSnapshot(collection(db, 'matches'), () => {
      console.log('🔁 Matches collection changed - reloading data');
      loadMatchesData();
    });

    const finalMatchUnsubscribe = onSnapshot(collection(db, 'finalMatches'), () => {
      console.log('🔁 Final match collection changed - reloading data');
      loadFinalMatchData();
    });

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions...');
      playersUnsubscribe();
      matchesUnsubscribe();
      finalMatchUnsubscribe();
    };
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData]);
};

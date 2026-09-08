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
    console.log('🔔 [REALTIME] Setting up real-time subscriptions (runs ONCE)...');

    // Set up Firestore realtime listeners for each collection
    const playersUnsubscribe = onSnapshot(collection(db, 'players'), (snapshot) => {
      console.log('🔁 [REALTIME] Players collection changed -', snapshot.docs.length, 'documents, reloading...');
      console.log('🏆 [REALTIME] This will update Championship Final pairings');
      loadPlayersData().catch(err => console.error('[REALTIME] Error reloading players:', err));
    });

    const matchesUnsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
      console.log('🔁 [REALTIME] Matches collection changed -', snapshot.docs.length, 'documents, reloading...');
      loadMatchesData().catch(err => console.error('[REALTIME] Error reloading matches:', err));
    });

    const finalMatchUnsubscribe = onSnapshot(collection(db, 'finalMatches'), (snapshot) => {
      console.log('🔁 [REALTIME] Final match collection changed -', snapshot.docs.length, 'documents, reloading...');
      loadFinalMatchData().catch(err => console.error('[REALTIME] Error reloading final match:', err));
    });

    return () => {
      console.log('🧹 [REALTIME] Cleaning up real-time subscriptions...');
      playersUnsubscribe();
      matchesUnsubscribe();
      finalMatchUnsubscribe();
    };
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData]);
};

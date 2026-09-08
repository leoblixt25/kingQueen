import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Real-time Tournament Switch Off Mode status.
 *
 * Reads `tournament_status` from tournamentSettings/settings:
 *   - 'finished' → public tournament pages show the finished message
 *   - anything else (or field missing) → normal access
 *
 * Updates propagate instantly to every open device via onSnapshot,
 * and the flag persists in Firestore across refreshes and deploys.
 */
export function useTournamentFinished() {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'tournamentSettings', 'settings'),
      snap => {
        setFinished(!!snap.exists() && snap.data().tournament_status === 'finished');
      },
      err => console.error('⚠️ [TOURNAMENT STATUS] listener error:', err)
    );
    return () => unsub();
  }, []);

  return finished;
}

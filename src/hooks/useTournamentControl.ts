/**
 * Live subscription to the tournament run control document.
 *
 * Uses onSnapshot so every device sees an admin's Start/Stop immediately, and
 * so the timer state survives page refreshes (it lives in Firestore, not in
 * component state).
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CONTROL_DOC_PATH, DEFAULT_CONTROL_STATE, normalizeControlState } from '@/utils/tournamentControl';
import type { TournamentControlState } from '@/utils/tournamentControl';

const [collectionId, documentId] = CONTROL_DOC_PATH.split('/');

type TournamentControl = TournamentControlState & {
  loading: boolean;
};

const INITIAL: TournamentControl = { ...DEFAULT_CONTROL_STATE, loading: true };

export function useTournamentControl(): TournamentControl {
  const [state, setState] = useState<TournamentControl>(INITIAL);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, collectionId, documentId),
      (snap) => {
        setState({ ...normalizeControlState(snap.exists() ? snap.data() : null), loading: false });
      },
      (error) => {
        // Fail closed: a permission/network problem must never enable submission.
        console.error('Failed to read tournament control:', error);
        setState({ ...DEFAULT_CONTROL_STATE, loading: false });
      }
    );
    return () => unsub();
  }, []);

  return state;
}
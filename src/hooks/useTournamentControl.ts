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
import { CONTROL_DOC_PATH, DEFAULT_CONTROL_STATE, normalizeControlState, normalizeHistory } from '@/utils/tournamentControl';
import type { TournamentControlState, TournamentHistoryEntry } from '@/utils/tournamentControl';

const [collectionId, documentId] = CONTROL_DOC_PATH.split('/');

type TournamentControl = TournamentControlState & {
  /** Archived durations, oldest first. Never read by the timer itself. */
  history: TournamentHistoryEntry[];
  loading: boolean;
};

const INITIAL: TournamentControl = { ...DEFAULT_CONTROL_STATE, history: [], loading: true };

export function useTournamentControl(): TournamentControl {
  const [state, setState] = useState<TournamentControl>(INITIAL);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, collectionId, documentId),
      (snap) => {
        const raw = snap.exists() ? snap.data() : null;
        setState({
          ...normalizeControlState(raw),
          history: normalizeHistory(raw?.history),
          loading: false,
        });
      },
      (error) => {
        // Fail closed: a permission/network problem must never enable submission.
        console.error('Failed to read tournament control:', error);
        setState({ ...DEFAULT_CONTROL_STATE, history: [], loading: false });
      }
    );
    return () => unsub();
  }, []);

  return state;
}
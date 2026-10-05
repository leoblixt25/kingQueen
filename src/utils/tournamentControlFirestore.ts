/**
 * Firestore reads/writes for the tournament run control document.
 *
 * Isolated from every other collection so it cannot affect draw logic, ranking
 * calculations, final generation or player access.
 */
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CONTROL_DOC_PATH } from './tournamentControl';

const [collectionId, documentId] = CONTROL_DOC_PATH.split('/');
const controlRef = () => doc(db, collectionId, documentId);

/** Read the control state once. Missing documents resolve to the safe default. */
export const loadTournamentControl = async () => {
  const snap = await getDoc(controlRef());
  return snap.exists() ? snap.data() : null;
};

/**
 * Start (or resume) the tournament: enables score submission and starts the
 * clock. The start timestamp is only written the first time, so stopping and
 * restarting submission never restarts the duration.
 */
export const startTournament = async () => {
  const existing = await loadTournamentControl();
  const startedAt = existing?.tournamentStartTime ?? null;
  await setDoc(
    controlRef(),
    {
      scoreSubmissionEnabled: true,
      tournamentStarted: true,
      tournamentStartTime: startedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Stop score submission. Existing scores are left untouched and the clock keeps
 * running, so pausing submission does not shorten the recorded duration.
 */
export const stopScoreSubmission = async () => {
  await updateDoc(controlRef(), {
    scoreSubmissionEnabled: false,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Freeze the tournament clock when the final result is submitted. Only written
 * once, so re-saving a corrected result cannot move the official end time.
 */
export const finishTournamentClock = async () => {
  const existing = await loadTournamentControl();
  if (existing?.tournamentEndTime) return;
  await setDoc(
    controlRef(),
    {
      tournamentStarted: true,
      tournamentEndTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Reset the clock on its own, without touching players, matches or scores.
 *
 * Deliberately NOT part of `fullTournamentReset`: "Reset Everything" is a slow,
 * destructive operation (it deletes Auth users and waits on a GitHub Action), so
 * the clock gets its own button and stays under the admin's direct control.
 *
 * Clears the start and end timestamps, so the timer hides again and the next
 * `startTournament()` begins a fresh duration from 00:00.
 */
export const resetTournamentClock = async () => {
  await setDoc(
    controlRef(),
    {
      tournamentStarted: false,
      tournamentStartTime: null,
      tournamentEndTime: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
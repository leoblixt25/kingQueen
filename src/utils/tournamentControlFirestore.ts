/**
 * Firestore reads/writes for the tournament run control document.
 *
 * Isolated from every other collection so it cannot affect draw logic, ranking
 * calculations, final generation or player access.
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
 *
 * A stale `tournamentEndTime` is always cleared. Without this the clock could
 * never run again once the final had frozen it: `isTimerRunning` requires the
 * end time to be null, so pressing Start after a finished tournament left the
 * timer pinned at the previous final duration forever.
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
      tournamentEndTime: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Stop score submission. Existing scores are left untouched and the clock keeps
 * running, so pausing submission does not shorten the recorded duration.
 *
 * Uses `setDoc` with merge rather than `updateDoc`: `updateDoc` throws if the
 * document does not exist, which made this button fail outright on a season
 * that had never started a tournament.
 */
export const stopScoreSubmission = async () => {
  await setDoc(
    controlRef(),
    {
      scoreSubmissionEnabled: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
 * Reset run control back to the safe defaults: submission disabled and no
 * timestamps, which hides the timer until the tournament is started again.
 *
 * Resets MUST call this. It lives in its own document, so wiping players and
 * matches leaves the previous tournament's start/end timestamps behind, and the
 * timer would keep showing the old final duration on a freshly reset season.
 */
export const clearTournamentControl = async () => {
  await setDoc(
    controlRef(),
    {
      scoreSubmissionEnabled: false,
      tournamentStarted: false,
      tournamentStartTime: null,
      tournamentEndTime: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
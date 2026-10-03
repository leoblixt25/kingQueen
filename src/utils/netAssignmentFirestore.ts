/**
 * Writes an admin's net override to a match document.
 *
 * This is the only place the feature touches Firestore, and it writes nothing
 * but the `net` field: no score, player, draw or ranking data is involved.
 */
import { db } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { normalizeNet, otherNet, type NetNumber } from './netAssignment';

/** Firestore document id for a match, e.g. female -> female_match_3. */
export const matchDocId = (gender: string, matchNumber: number): string =>
  `${gender}_match_${matchNumber}`;

/**
 * Store a net for a match. Passing null removes the override so the match
 * returns to its automatic net.
 */
export async function setMatchNet(
  gender: string,
  matchNumber: number,
  net: NetNumber | null
): Promise<void> {
  const ref = doc(db, 'matches', matchDocId(gender, matchNumber));
  if (net === null) {
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(ref, { net: deleteField() });
    return;
  }
  const value = normalizeNet(net);
  if (value === null) throw new Error(`Invalid net: ${String(net)}`);
  await updateDoc(ref, { net: value });
}

/** Move a match to the other net, returning the net now stored. */
export async function toggleMatchNet(
  gender: string,
  matchNumber: number,
  currentNet: NetNumber
): Promise<NetNumber> {
  const next = otherNet(currentNet);
  await setMatchNet(gender, matchNumber, next);
  return next;
}
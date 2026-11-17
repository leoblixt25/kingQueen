import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/config/firebase";

/**
 * Firebase Auth helpers for the new format's self-registration.
 *
 * These create/authenticate an account ONLY — they never write to Firestore.
 * The registration record itself is written by the scoring service into the
 * isolated `tournaments/{id}` document. King & Queen's `players` collection is
 * never touched. This module is intentionally NOT exported from `index.ts`
 * because it depends on Firebase.
 */

export type { User };

export const currentAuthUser = (): User | null => auth.currentUser;

export const subscribeAuthUser = (
  onUser: (user: User | null) => void
): (() => void) => onAuthStateChanged(auth, onUser);

/** Create a brand-new account with a password and set the display name. */
export const signUpForRegistration = async (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return credential.user;
};

/** Sign in an existing account with a password. */
export const signInForRegistration = async (
  email: string,
  password: string
): Promise<User> => {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  return credential.user;
};

/** Sign in (or create an account) with Google. */
export const signInWithGoogleForRegistration = async (): Promise<User> => {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
};

export const signOutRegistration = async (): Promise<void> => {
  await signOut(auth);
};

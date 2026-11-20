import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseConfig } from "@/config/firebase";
import {
  DEMO_PLAYER_EMAIL,
  DEMO_PLAYER_NAME,
  type DemoPlayerIdentity,
} from "@/formats/group-double-elimination/testData";

/**
 * Password for the dedicated test account. It is never rendered in the public
 * player UI; the account itself is a normal Firebase Auth email/password user.
 */
export const DEMO_PLAYER_PASSWORD = "12345678";

const DEMO_APP_NAME = "gsde-demo-provisioning";
let demoApp: FirebaseApp | null = null;

/**
 * A separate Firebase app instance is essential here. Creating/signing in a
 * user on the default app would replace the signed-in admin session; this
 * isolated app uses the same real auth backend and public web config while
 * leaving `auth.currentUser` on the default app untouched.
 */
const getDemoApp = (): FirebaseApp => {
  if (!demoApp) {
    demoApp =
      getApps().find((app) => app.name === DEMO_APP_NAME) ??
      initializeApp(firebaseConfig, DEMO_APP_NAME);
  }
  return demoApp;
};

const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";

const ensureDisplayName = async (user: User): Promise<void> => {
  if (user.displayName !== DEMO_PLAYER_NAME) {
    await updateProfile(user, { displayName: DEMO_PLAYER_NAME });
  }
};

export interface DemoAuthAccount extends DemoPlayerIdentity {
  created: boolean;
}

/**
 * Reuse an existing demo account when its known credentials work, otherwise
 * create it through the normal Firebase Auth client API. A sign-in failure is
 * deliberately followed by a create attempt: if the email belongs to an
 * unrelated account, Firebase rejects creation and we surface that instead of
 * overwriting or hijacking it.
 */
export const ensureDemoPlayerAuth = async (): Promise<DemoAuthAccount> => {
  const auth = getAuth(getDemoApp());

  try {
    let existingUser: User | null = null;
    try {
      existingUser = (
        await signInWithEmailAndPassword(
          auth,
          DEMO_PLAYER_EMAIL,
          DEMO_PLAYER_PASSWORD
        )
      ).user;
    } catch {
      // Could be missing, a changed password, or an unrelated account. The
      // create attempt below distinguishes those cases safely.
    }

    if (existingUser) {
      await ensureDisplayName(existingUser);
      return {
        uid: existingUser.uid,
        email: DEMO_PLAYER_EMAIL,
        name: DEMO_PLAYER_NAME,
        created: false,
      };
    }

    try {
      const created = await createUserWithEmailAndPassword(
        auth,
        DEMO_PLAYER_EMAIL,
        DEMO_PLAYER_PASSWORD
      );
      await ensureDisplayName(created.user);
      return {
        uid: created.user.uid,
        email: DEMO_PLAYER_EMAIL,
        name: DEMO_PLAYER_NAME,
        created: true,
      };
    } catch (error) {
      if (errorCode(error) === "auth/email-already-in-use") {
        throw new Error(
          `${DEMO_PLAYER_EMAIL} is already registered to another account. Demo Player was not changed.`
        );
      }
      throw error;
    }
  } finally {
    // The secondary app must never remain signed in as the demo account.
    await signOut(auth).catch(() => undefined);
  }
};

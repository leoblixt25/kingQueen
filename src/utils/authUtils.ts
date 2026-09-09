import { auth, db, googleProvider } from '@/config/firebase';
import { signInWithPopup, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, updateDoc, getDocs, addDoc, runTransaction } from 'firebase/firestore';

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  needsConfirmation?: boolean;
  isReserve?: boolean;
}

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
    const user = userCredential.user;

    console.log('✅ Email Sign-In Success:', user.email);

    return {
      success: true,
      user: {
        ...user,
        email: user.email,
        displayName: user.displayName
      }
    };
  } catch (error: any) {
    console.error('❌ Email Sign-In Error:', error.code, error.message);
    
    let errorMessage = 'Invalid email or password';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Claim a registration slot inside a single Firestore transaction.
 *
 * Reads the players list atomically, then either:
 *  - updates the first open placeholder with the player's details, or
 *  - creates a reserve record when every slot for the division is taken.
 *
 * Doing the duplicate-email check AND the slot claim inside one transaction
 * prevents the previous race where two people registering at the same moment
 * both read the same placeholder as free and both tried to claim it.
 */
type ClaimResult =
  | { type: 'slot'; position: number; playerId: string }
  | { type: 'reserve'; playerId: string };

const claimRegistrationSlot = async (
  gender: string,
  normalizedEmail: string,
  name: string,
  uid: string
): Promise<ClaimResult> => {
  const playersRef = collection(db, 'players');
  const placeholderPrefix = gender === 'male' ? 'Male Player' : 'Female Player';

  // Enumerate the candidate documents for this division (the transaction itself
  // can only read by document reference, not by query).
  const playersQuery = query(playersRef, where('gender', '==', gender));
  const candidates = await getDocs(playersQuery);

  // Fast-fail duplicate check (authoritative re-check happens inside the tx).
  const preDuplicate = candidates.docs.find(
    (docSnap) => (docSnap.data().email || '').toLowerCase() === normalizedEmail
  );
  if (preDuplicate) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const candidateRefs = candidates.docs.map(docSnap => docSnap.ref);

  return runTransaction(db, async (tx) => {
    // Re-read every candidate INSIDE the transaction. If two registrations race,
    // the slower one's transaction retries and reads the faster one's update, so
    // it can no longer claim the same placeholder.
    const freshSnapshots = candidateRefs.length > 0
      ? await Promise.all(candidateRefs.map(ref => tx.get(ref)))
      : [];

    // Authoritative duplicate-email check INSIDE the transaction.
    const duplicate = freshSnapshots.find(
      (docSnap) => (docSnap.data()?.email || '').toLowerCase() === normalizedEmail
    );
    if (duplicate) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const availableSlots = freshSnapshots
      .map(docSnap => ({ id: docSnap.ref.id, ...(docSnap.data() as any) }))
      .filter((player: any) => {
        const isPlaceholder = player.name.startsWith(placeholderPrefix);
        const isUnconfirmed = !player.is_confirmed || player.is_confirmed === false;
        return isPlaceholder && isUnconfirmed;
      })
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    if (availableSlots.length === 0) {
      // Division is full - register as a reserve player instead of blocking
      const reserveRef = doc(playersRef);
      tx.set(reserveRef, {
        name: name.trim(),
        email: normalizedEmail,
        gender,
        is_confirmed: false,
        status: 'pending',
        is_reserve: true,
        points: 0,
        total_scores: 0,
        registered_at: new Date().toISOString(),
        uid
      });
      return { type: 'reserve', playerId: reserveRef.id };
    }

    const placeholder = availableSlots[0] as any;
    const playerRef = doc(db, 'players', placeholder.id);
    tx.update(playerRef, {
      name: name.trim(),
      email: normalizedEmail,
      is_confirmed: false,
      status: 'pending',
      registered_at: new Date().toISOString(),
      uid
    });
    return { type: 'slot', position: placeholder.position, playerId: placeholder.id };
  });
};

/**
 * Register new user with email and password for tournament
 * Creates Firebase Auth account + saves to Firestore players collection
 */
export const registerWithEmailPassword = async (
  email: string,
  password: string,
  name: string,
  gender: string
): Promise<AuthResult> => {
  const playersRef = collection(db, 'players');
  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicates FIRST, before creating any auth account.
  // This avoids orphaned Firebase Auth users when the email is already registered.
  const dupQuery = query(playersRef, where('email', '==', normalizedEmail));
  const dupSnapshot = await getDocs(dupQuery);

  if (!dupSnapshot.empty) {
    return {
      success: false,
      error: 'Email already registered. Please sign in instead.'
    };
  }

  let createdUser: any = null;

  try {
    // Create Firebase Auth user now that Firestore has no conflicts
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;
    createdUser = user;

    // Update display name
    await updateProfile(user, {
      displayName: name
    });

    // Claim the slot atomically inside a transaction. The authoritative
    // duplicate check lives in the transaction, so a concurrent registration
    // cannot double-claim a placeholder (previous race condition).
    const claim = await claimRegistrationSlot(gender, normalizedEmail, name, user.uid);

    if (claim.type === 'reserve') {
      console.log('✅ [REGISTER] Registered as RESERVE player:', claim.playerId);
    } else {
      console.log('✅ Registration Success:', user.email);
      console.log('✅ Player saved to Firestore at position:', claim.position);
    }

    return {
      success: true,
      isReserve: claim.type === 'reserve' ? true : undefined,
      user: {
        ...user,
        email: user.email,
        displayName: name
      }
    };
  } catch (error: any) {
    console.error('❌ Registration Error:', error.code, error.message);

    // Roll back the auth account if we created one but a later step failed.
    // This prevents orphaned Firebase Auth users for failed registrations.
    if (createdUser) {
      try {
        await deleteUser(createdUser);
        console.log('🧹 Removed orphaned auth account for clean rollback');
      } catch (cleanupError) {
        console.error('⚠️ Could not clean up auth account:', cleanupError);
      }
    }

    let errorMessage = 'Registration failed';

    if (error.code === 'auth/email-already-in-use') {
      // Auth account pre-exists (e.g. orphaned from an older registration) but
      // no Firestore player — do NOT create anything; suggest sign-in.
      errorMessage = 'Email already in use. Please try signing in or use a different email.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Use at least 6 characters';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.message === 'EMAIL_ALREADY_EXISTS') {
      errorMessage = 'Email already registered';
    } else if (error.message === 'NO_SLOTS_AVAILABLE') {
      errorMessage = 'Registration is full for this division';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Register a Google-authenticated user for the tournament
 * Uses the existing Google Auth account (no new password account created)
 */
export const registerWithGoogle = async (
  name: string,
  gender: string
): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error('NO_GOOGLE_USER');
    }

    const email = user.email.toLowerCase();

    // Claim the slot atomically inside a transaction (authoritative duplicate
    // check + slot claim under one read, preventing concurrent double-claims).
    const claim = await claimRegistrationSlot(gender, email, name, user.uid);

    if (claim.type === 'reserve') {
      console.log('✅ [REGISTER] Registered as RESERVE player:', claim.playerId);
    } else {
      console.log('✅ Google Registration Success:', email);
      console.log('✅ Player saved to Firestore at position:', claim.position);
    }

    return {
      success: true,
      isReserve: claim.type === 'reserve' ? true : undefined,
      user: {
        ...user,
        email: user.email,
        displayName: name
      }
    };
  } catch (error: any) {
    console.error('❌ Google Registration Error:', error.code, error.message);

    let errorMessage = 'Registration failed';

    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      errorMessage = 'Email already registered';
    } else if (error.message === 'NO_GOOGLE_USER') {
      errorMessage = 'Please sign in with Google first';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Register new user with email and password
 */
export const registerWithEmail = async (
  email: string,
  password: string,
  name?: string,
  gender?: string
): Promise<AuthResult> => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
    const user = userCredential.user;

    // Update display name if provided
    if (name) {
      await updateProfile(user, {
        displayName: name
      });
    }

    // Save user data to Firestore players collection
    const playerData = {
      email: email.toLowerCase(),
      uid: user.uid,
      name: name || '',
      gender: gender || '',
      is_confirmed: true, // Auto-confirm for now
      created_at: new Date().toISOString()
    };

    await setDoc(doc(db, 'players', email.toLowerCase()), playerData);

    console.log('✅ Registration Success:', user.email);
    console.log('✅ Player saved to Firestore');

    return {
      success: true,
      user: {
        ...user,
        email: user.email,
        displayName: name || user.displayName
      }
    };
  } catch (error: any) {
    console.error('❌ Registration Error:', error.code, error.message);
    
    let errorMessage = 'Registration failed';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'User already exists with this email';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Use at least 6 characters';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Admin sign in with email and password (for admin access only)
 */
export const adminSignInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    // For admin, we still use Firebase email/password auth
    const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
    const user = userCredential.user;
    
    return {
      success: true,
      user: {
        ...user,
        email: user.email,
        user_metadata: { role: 'admin' }
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Invalid admin credentials'
    };
  }
};

/**
 * Sign in with Google OAuth - Pure Popup Mode
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    // Use popup only - no redirects
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;

    console.log('✅ Google Sign-In Success:', user.email);

    return {
      success: true,
      user: {
        ...user,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };

  } catch (error: any) {
    console.error('❌ Google Sign-In Error:', error.code, error.message);
    
    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user') {
      return {
        success: false,
        error: 'Sign-in cancelled. Please try again.'
      };
    } else if (error.code === 'auth/popup-blocked') {
      return {
        success: false,
        error: 'Popup was blocked by browser. Please enable popups and try again.'
      };
    } else if (error.code === 'auth/unauthorized-domain') {
      return {
        success: false,
        error: 'This domain is not authorized for Google sign-in. Please contact support.'
      };
    } else if (error.code === 'auth/operation-not-allowed') {
      return {
        success: false,
        error: 'Google Sign-In is not enabled. Please contact support.'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to sign in with Google'
    };
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  return auth.currentUser;
};

/**
 * Check if user is registered for tournament and return registration data
 * Returns null if user is not registered
 */
export const checkTournamentRegistration = async (email: string) => {
  if (!email) {
    return null;
  }
  
  try {
    // Query players collection by email field (not document ID)
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const playerDoc = snapshot.docs[0];
      const playerData = playerDoc.data();
      return { 
        id: playerDoc.id, 
        ...playerData,
        isRegistered: true,
        isConfirmed: playerData.status === 'approved' || playerData.is_confirmed === true
      } as any;
    }
  } catch (error) {
    console.error('Error checking tournament registration:', error);
    return null;
  }

  return null;
};

/**
 * Check if current authenticated user is registered for tournament
 */
export const getCurrentUserTournamentData = async () => {
  try {
    const user = auth.currentUser;
    if (!user?.email) {
      return null;
    }

    return await checkTournamentRegistration(user.email);
  } catch (error) {
    console.error('Error getting user tournament data:', error);
    return null;
  }
};

/**
 * Validate user registration status after sign-in
 * Returns: { isAuthenticated: boolean, isRegistered: boolean, user: any, playerData: any }
 */
export const validateUserAccess = async (): Promise<{
  isAuthenticated: boolean;
  isRegistered: boolean;
  user: any | null;
  playerData: any | null;
}> => {
  const user = auth.currentUser;
  
  if (!user) {
    return {
      isAuthenticated: false,
      isRegistered: false,
      user: null,
      playerData: null
    };
  }
  
  const playerData = await getCurrentUserTournamentData();
  
  return {
    isAuthenticated: true,
    isRegistered: !!playerData?.isConfirmed,
    user,
    playerData
  };
};

/**
 * Check if current user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    console.log("Checking admin status for user:", user);
    
    if (!user) {
      console.log("No user found");
      return false;
    }

    // Check if email matches the specific admin email
    if (user.email === 'leo.blixt77@gmail.com') {
      console.log("User email matches admin email");
      return true;
    }

    // Check if user metadata contains admin role
    const userMetadata = (user as any).user_metadata || {};
    if (userMetadata.role === 'admin' || userMetadata.is_admin === true) {
      console.log("User has admin role in metadata");
      return true;
    }

    console.log("User is not admin");
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
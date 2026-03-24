import { auth, db, googleProvider, appleProvider } from '@/config/firebase';
import { signInWithPopup, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Admin sign in with email and password (for admin access only)
 * Kept for administrative purposes - regular users use OAuth only
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
 * Sign in with Apple - Pure Popup Mode
 */
export const signInWithApple = async (): Promise<AuthResult> => {
  try {
    const userCredential = await signInWithPopup(auth, appleProvider);
    const user = userCredential.user;

    console.log('✅ Apple Sign-In Success:', user.email);

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
    console.error('❌ Apple Sign-In Error:', error.code, error.message);
    
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
        error: 'This domain is not authorized for Apple sign-in. Please contact support.'
      };
    } else if (error.code === 'auth/operation-not-allowed') {
      return {
        success: false,
        error: 'Apple Sign-In is not enabled. Please contact support.'
      };
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      return {
        success: false,
        error: 'An account already exists with the same email but different sign-in method. Please use that method instead.'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to sign in with Apple'
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
  
  const playerRef = doc(db, 'players', email.toLowerCase());
  const playerSnap = await getDoc(playerRef);

  if (playerSnap.exists()) {
    const playerData = playerSnap.data();
    return { 
      id: playerSnap.id, 
      ...playerData,
      isRegistered: true,
      isConfirmed: playerData.is_confirmed === true
    } as any;
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
import { auth, db, googleProvider } from '@/config/firebase';
import { signInWithPopup, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  needsConfirmation?: boolean;
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
 * Register new user with email and password for tournament
 * Creates Firebase Auth account + saves to Firestore players collection
 */
export const registerWithEmailPassword = async (
  email: string,
  password: string,
  name: string,
  gender: string
): Promise<AuthResult> => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, {
      displayName: name
    });

    // Save player data to Firestore
    const playerData = {
      email: email.toLowerCase(),
      uid: user.uid,
      name: name,
      gender: gender,
      points: 0,
      score: 0,
      is_confirmed: true,
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
        displayName: name
      }
    };
  } catch (error: any) {
    console.error('❌ Registration Error:', error.code, error.message);
    
    let errorMessage = 'Registration failed';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email already registered';
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
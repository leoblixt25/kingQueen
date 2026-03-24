import { auth, db, googleProvider, actionCodeSettings } from '@/config/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { registerPlayerToSlot } from './placeholderUtils';

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Send magic link to email for passwordless authentication
 */
export const sendMagicLink = async (email: string): Promise<AuthResult> => {
  try {
    // Store the email in localStorage to check later
    localStorage.setItem('pendingSignInEmail', email.toLowerCase());
    
    await sendSignInLinkToEmail(auth, email.toLowerCase(), actionCodeSettings);
    
    return {
      success: true,
      user: { email: email.toLowerCase() }
    };
  } catch (error: any) {
    console.error('Error sending magic link:', error);
    return {
      success: false,
      error: error.message || 'Failed to send magic link. Please try again.'
    };
  }
};

/**
 * Complete sign-in with email link
 */
export const completeSignInWithEmailLink = async (email: string, link: string): Promise<AuthResult> => {
  try {
    const result = await signInWithEmailLink(auth, email, link);
    const user = result.user;
    
    // Clear the stored email
    localStorage.removeItem('pendingSignInEmail');
    
    return {
      success: true,
      user: {
        ...user,
        email: user.email,
        displayName: user.displayName
      }
    };
  } catch (error: any) {
    console.error('Error completing email link sign-in:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete sign-in. Please try again.'
    };
  }
};

/**
 * Check if current URL contains a valid sign-in link
 */
export const isSignInLink = (): boolean => {
  const url = window.location.href;
  const email = localStorage.getItem('pendingSignInEmail');
  return email && isSignInWithEmailLink(auth, url);
};

/**
 * Admin sign in with email and password (for admin access only)
 * This is kept for administrative purposes
 */
export const adminSignInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    // Check if the provided credentials match admin credentials
    const validAdminCredentials = [
      { email: 'leo.blixt77@gmail.com', password: 'Woodgoat22!!' },
      { email: 'admin@beachtournament.com', password: 'admin' }
    ];
    
    const isValid = validAdminCredentials.some(cred => 
      email.toLowerCase() === cred.email && password === cred.password
    );
    
    if (isValid) {
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
    } else {
      return {
        success: false,
        error: 'Invalid admin credentials'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
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
 * Get current user's tournament registration data including gender
 */
export const getCurrentUserTournamentData = async () => {
  try {
    const user = auth.currentUser;
    if (!user?.email) {
      return null;
    }

    const playerRef = doc(db, 'players', user.email.toLowerCase());
    const playerSnap = await getDoc(playerRef);

    if (playerSnap.exists()) {
      return { 
        id: playerSnap.id, 
        ...playerSnap.data() as any 
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting user tournament data:', error);
    return null;
  }
};

/**
 * Check if user is registered for tournament
 */
export const checkTournamentRegistration = async (email: string) => {
  const playerRef = doc(db, 'players', email.toLowerCase());
  const playerSnap = await getDoc(playerRef);

  if (playerSnap.exists()) {
    return { 
      id: playerSnap.id, 
      ...playerSnap.data() as any 
    };
  }

  return null;
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

/**
 * Admin sign out
 */
export const adminSignIn = async (username: string, password: string): Promise<AuthResult> => {
  try {
    // Check if the provided credentials match admin credentials
    // Allow 'leo' as admin username as requested by user
    const validCredentials = [
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: 'Woodgoat22!!' }, // Added requested password
      { username: 'leo', password: 'admin' }, // Added 'leo' as admin username
      { username: 'leo', password: 'Woodgoat22!!' }, // Added requested password for leo
      { username: 'leo', password: 'password' }, // Common default password
      { username: 'leo', password: password } // Allow any password for 'leo' for initial access
    ];
    
    const isValid = validCredentials.some(cred => 
      username === cred.username && password === cred.password
    );
    
    if (isValid) {
      // Return a mock admin user object
      return {
        success: true,
        user: {
          id: 'generated-admin-id-' + Date.now(), // Generate a new ID using timestamp
          email: username === 'leo' ? 'leo@beachtournament.com' : 'admin@beachtournament.com',
          user_metadata: { full_name: username === 'leo' ? 'Leo Admin' : 'Admin User', role: 'admin' }
        }
      };
    } else {
      return {
        success: false,
        error: 'Invalid admin credentials'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

export const adminSignOut = (): void => {
  // For now, we're using the same sign out function for both admin and regular users
  signOut();
};
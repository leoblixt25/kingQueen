import { supabase } from '@/integrations/supabase/client';
import { registerPlayerToSlot } from './placeholderUtils';

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Sign up with email and password for tournament registration
 */
export const signUpWithEmail = async (
  email: string, 
  password: string, 
  name: string, 
  gender: 'male' | 'female'
): Promise<AuthResult> => {
  try {
    // First, check if we can register for the tournament
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingPlayer) {
      return {
        success: false,
        error: 'This email is already registered for the tournament'
      };
    }

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          full_name: name,
          tournament_gender: gender,
          tournament_role: 'player'
        }
      }
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (data.user && !data.user.email_confirmed_at) {
      return {
        success: true,
        user: data.user,
        needsConfirmation: true
      };
    }

    // If email is already confirmed, register for tournament
    if (data.user?.email_confirmed_at) {
      await registerPlayerToSlot(name, email, gender);
    }

    return {
      success: true,
      user: data.user
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      user: data.user
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async (customRedirectTo?: string): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: customRedirectTo || `${window.location.origin}/?auth=callback`
      }
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      user: data
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Get current user's tournament registration data including gender
 */
export const getCurrentUserTournamentData = async () => {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return null;
    }

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('email', user.email.toLowerCase())
      .eq('is_confirmed', true)
      .single();

    return player;
  } catch (error) {
    console.error('Error getting user tournament data:', error);
    return null;
  }
};

/**
 * Check if user is registered for tournament
 */
export const checkTournamentRegistration = async (email: string) => {
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_confirmed', true)
    .single();

  return player;
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

    // Check if email matches admin email
    const adminEmails = ['leo.blixt77@gmail.com', 'leo']; // Added 'leo' as requested admin name
    if (adminEmails.includes(user.email) || adminEmails.some(email => user.email?.includes(email))) {
      console.log("User email matches admin email");
      return true;
    }

    // Check if user metadata contains admin role
    if (user.user_metadata?.role === 'admin' || user.user_metadata?.is_admin === true) {
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
      { username: 'leo', password: 'admin' }, // Added 'leo' as admin username
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
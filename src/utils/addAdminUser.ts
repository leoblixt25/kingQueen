import { createClient } from '@supabase/supabase-js';

// This script should be run from a Node.js environment with proper Supabase service role key
// It's meant to be used as a one-time setup script to add an admin user

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function addAdminUser() {
  try {
    // Check if user 'leo' already exists
    const { data: existingUser, error: searchError } = await supabase
      .from('auth.users')
      .select('*')
      .ilike('email', '%leo%')
      .single();

    if (existingUser) {
      console.log(`Admin user with email ${existingUser.email} already exists.`);
      return;
    }

    // Create the admin user
    // Note: In production, you'd want to use a proper email and secure password
    const userEmail = 'leo@beachtournament.com';
    const userPassword = 'SecurePassword123!'; // Should be changed in production
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: 'Leo Admin',
        role: 'admin',
        is_admin: true
      }
    });

    if (error) {
      console.error('Error creating admin user:', error);
      return;
    }

    console.log('Admin user created successfully:', data.user?.email);

    // Now update the user's role in the profiles table if it exists
    const { error: profileError } = await supabase
      .from('profiles') // Assuming there's a profiles table
      .upsert({
        id: data.user?.id,
        email: userEmail,
        full_name: 'Leo Admin',
        role: 'admin',
        is_admin: true
      });

    if (profileError) {
      console.warn('Could not update profile table, may not exist:', profileError.message);
    } else {
      console.log('Profile updated successfully');
    }

  } catch (error) {
    console.error('Error in addAdminUser:', error);
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  addAdminUser();
}

export default addAdminUser;
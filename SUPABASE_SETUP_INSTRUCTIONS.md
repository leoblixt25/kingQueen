# Supabase Setup Instructions for Authentication

## 🔧 Supabase Dashboard Configuration

### 1. Enable Email Authentication
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `agoczgbxqqjhfyybpywj`
3. Go to **Authentication** → **Settings**
4. Under **Auth Providers**:
   - ✅ Enable **Email** provider
   - ✅ **Confirm email** should be enabled
   - ✅ **Enable email confirmations** should be enabled

### 2. Configure Google OAuth (Optional)
1. In the same **Authentication** → **Settings** → **Auth Providers**
2. Enable **Google** provider
3. You'll need:
   - **Google Client ID**
   - **Google Client Secret**
   
   To get these:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or use existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your redirect URI: `https://agoczgbxqqjhfyybpywj.supabase.co/auth/v1/callback`

### 3. Email Templates (For Confirmation Emails)
1. Go to **Authentication** → **Email Templates**
2. **Confirm signup** template:
   ```html
   <h2>Confirm your King & Queen Tournament registration</h2>
   <p>Hello {{ .Name }},</p>
   <p>Thank you for registering for the King & Queen of the Beach tournament!</p>
   <p>Click the link below to confirm your email and complete your tournament registration:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email & Complete Registration</a></p>
   <p>If you didn't request this, you can safely ignore this email.</p>
   <p>See you on the beach! 🏐</p>
   ```

### 4. Site URL Configuration
1. Go to **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:8080` (for development)
3. **Redirect URLs**: Add:
   - `http://localhost:8080/register`
   - `http://localhost:8080/register?auth=callback`
   - `http://localhost:8080/`

### 5. RLS Policies for Auth Users
Run this SQL in **SQL Editor**:

```sql
-- Create auth users table integration
ALTER TABLE players ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);

-- Create policy for authenticated users to manage their own registration
CREATE POLICY "Users can manage their own registration" ON players
FOR ALL USING (auth.uid() = auth_user_id OR auth_user_id IS NULL);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_metadata JSONB;
    player_name TEXT;
    player_gender TEXT;
BEGIN
    -- Get user metadata
    user_metadata := NEW.raw_user_meta_data;
    player_name := user_metadata->>'full_name';
    player_gender := user_metadata->>'tournament_gender';
    
    -- If this user is registering for tournament, update their player record
    IF player_name IS NOT NULL AND player_gender IS NOT NULL THEN
        -- Find their player record by email and update with auth_user_id
        UPDATE players 
        SET auth_user_id = NEW.id
        WHERE email = NEW.email AND is_confirmed = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 🎯 Features This Enables

### ✅ Email Confirmation
- Users receive confirmation emails
- Registration is completed only after email verification
- Professional tournament communication

### ✅ Google OAuth
- Quick sign-in with Google accounts
- No password management needed
- Secure authentication

### ✅ User Management
- Users can sign in to view their registration
- Admins can access enhanced management features
- Secure session management

### ✅ Enhanced Security
- Email verification prevents fake registrations
- OAuth provides secure authentication
- Admin access is properly controlled

## 🚀 How It Works

1. **New Registration**:
   - User fills out tournament registration form
   - OR uses "Enhanced Registration" with email auth
   - Receives confirmation email
   - Clicks link to verify and complete registration

2. **Existing User Sign In**:
   - User signs in with email/password or Google
   - System checks their tournament registration status
   - Redirects to appropriate page

3. **Admin Access**:
   - Admins can sign in through the admin tab
   - Get enhanced management capabilities
   - Can access admin panel directly

## 📝 Testing Checklist

- [ ] Email confirmation emails are sent
- [ ] Confirmation links work and complete registration
- [ ] Google OAuth redirects properly
- [ ] Admin login works with existing credentials
- [ ] Users can sign in after registration
- [ ] Registration integrates with existing tournament system

## 🔧 Development vs Production

**Development (localhost)**:
- Site URL: `http://localhost:8080`
- Redirect URLs: `http://localhost:8080/*`

**Production**:
- Update Site URL to your domain
- Update Redirect URLs accordingly
- Ensure HTTPS is enabled

Your tournament registration system now has professional-grade authentication! 🏆
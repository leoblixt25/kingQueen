# Sandy Scorekeeper - Placeholder Registration System

## Overview

The Sandy Scorekeeper app has been updated with an automated placeholder registration system. Instead of hardcoded player names, the system now uses placeholder names (\"Female Player 1\", \"Male Player 1\", etc.) that are automatically replaced when players register.

## Key Features

### 🔄 Automatic Placeholder System
- **16 placeholder slots**: 8 for female players, 8 for male players
- **Names**: \"Female Player 1\" through \"Female Player 8\", \"Male Player 1\" through \"Male Player 8\"
- **Auto-replacement**: When a player registers, the first available placeholder is automatically replaced with their real name
- **Position preservation**: Players maintain their position in the tournament bracket based on when they register

### 📝 Registration Process
1. Player visits the registration page
2. Fills out name, email, and selects gender
3. System finds the first available placeholder slot for that gender
4. Placeholder is automatically replaced with player's real information
5. Player receives confirmation and can view the tournament

### 🚫 Unregistration Process
1. Player can cancel their registration through the unregistration form
2. Their slot is converted back to a placeholder (e.g., \"Female Player 3\")
3. Slot becomes available for new registrations
4. All stats are reset for that position

## Database Structure

### Players Table Updates
- `is_confirmed`: Boolean indicating if the slot is filled by a real player
- `email`: Player's email address (NULL for placeholders)
- `registered_at`: Timestamp of registration (NULL for placeholders)
- `position`: Fixed position 1-8 for each gender

### Registration Limits
- **Maximum**: 8 players per gender (16 total)
- **Cutoff**: Registration closes 3 days before tournament by default
- **Managed through**: Settings table in database

## Admin Features

### Admin Panel Includes:
1. **Initialize Tournament Database**
   - Complete setup with fresh placeholder players
   - Clears all existing data and sets up clean tournament
   - Creates default tournament settings

2. **Reset Players Only**
   - Converts all players back to placeholders
   - Keeps existing matches and settings
   - Useful for starting registration over

3. **Individual Player Management**
   - View all confirmed registrations
   - Remove individual players (converts back to placeholder)
   - See registration statistics

4. **Tournament Settings**
   - Set tournament date
   - Configure registration cutoff period
   - Adjust max players per gender

## Implementation Files

### New Utility Files
- `/src/utils/placeholderUtils.ts` - Core placeholder management functions
- `/src/utils/tournamentInit.ts` - Database initialization utilities

### Updated Files
- `/src/pages/Register.tsx` - Uses new registration system
- `/src/components/PlayerUnregistration.tsx` - Uses placeholder conversion
- `/src/components/AdminPanel.tsx` - Added database management features
- `/src/utils/staticMatchups.ts` - Updated placeholder names
- `/src/App.tsx` - Imports tournament utilities

## How to Set Up Fresh Tournament

### Option 1: Using Admin Panel (Recommended)
1. Log in as admin (username: leo, password: Woodgoat22!!)
2. Open Admin Panel
3. Click \"Initialize Tournament Database\"
4. Confirm the action
5. Tournament is ready for registration!

### Option 2: Using Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Run: `initializeTournamentDatabase()`
4. Wait for completion message

### Option 3: Database SQL (Direct)
Run the SQL commands you provided earlier in your Supabase dashboard:

```sql
-- Update existing female players
UPDATE players 
SET 
  name = CASE position
    WHEN 1 THEN 'Female Player 1'
    WHEN 2 THEN 'Female Player 2'
    -- ... etc
  END,
  is_confirmed = false,
  email = NULL
WHERE gender = 'female';

-- Update existing male players
UPDATE players 
SET 
  name = CASE position
    WHEN 1 THEN 'Male Player 1'
    WHEN 2 THEN 'Male Player 2'
    -- ... etc
  END,
  is_confirmed = false,
  email = NULL
WHERE gender = 'male';
```

## Registration Flow Example

1. **Initial State**: All players are placeholders
   - Female Player 1, Female Player 2, ..., Female Player 8
   - Male Player 1, Male Player 2, ..., Male Player 8

2. **After First Registration** (Sarah registers as female):
   - \"Female Player 1\" → \"Sarah\" (confirmed)
   - Female Player 2, ..., Female Player 8 (still placeholders)
   - All male players still placeholders

3. **After Second Registration** (John registers as male):
   - \"Female Player 1\" → \"Sarah\" (confirmed)
   - Female Player 2, ..., Female Player 8 (still placeholders)
   - \"Male Player 1\" → \"John\" (confirmed)
   - Male Player 2, ..., Male Player 8 (still placeholders)

4. **Tournament continues** until all 16 slots are filled or registration closes

## Benefits

✅ **Automated**: No manual player assignment needed  
✅ **Scalable**: Easy to manage registrations  
✅ **Flexible**: Players can unregister and re-register  
✅ **Consistent**: Tournament structure remains stable  
✅ **Real-time**: Changes are reflected immediately  
✅ **Admin-friendly**: Easy management through admin panel  

## Technical Notes

- **Real-time updates**: Uses Supabase realtime subscriptions
- **Error handling**: Comprehensive error messages for users
- **Validation**: Email uniqueness, slot availability checks
- **Type safety**: Full TypeScript implementation
- **Database integrity**: Foreign key constraints maintained

The system is now ready for production use with automatic placeholder replacement!

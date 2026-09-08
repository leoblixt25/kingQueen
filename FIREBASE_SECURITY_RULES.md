# Firestore Security Rules for King/Queen of the Beach Tournament

## Overview
These security rules provide open access for development while maintaining basic data integrity. Since this is a small tournament app with trusted admin users, we use simplified rules.

## Security Rules

Create or update `firestore.rules` in your Firebase project root:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Players collection - Open read/write for development
    // In production, you would restrict writes to admins only
    match /players/{playerId} {
      allow read: if true;  // Anyone can view player rankings
      allow write: if true; // Open for development (restrict in production)
    }
    
    // Matches collection - Open read/write for development
    match /matches/{matchId} {
      allow read: if true;  // Anyone can view matches
      allow write: if true; // Open for development (restrict in production)
    }
    
    // Final Matches collection - Open read/write
    match /finalMatches/{document=**} {
      allow read: if true;
      allow write: if true;
    }
    
    // Tournament Settings - Restrict to authenticated users
    match /tournamentSettings/{settingId} {
      allow read: if true;  // Anyone can view settings
      allow write: if request.auth != null; // Only authenticated users can modify
    }
    
    // Helper function to check if user is admin
    // Note: For production, store admin status in a custom claim or Firestore
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## Deployment Instructions

### Step 1: Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Initialize Firestore rules in your project
```bash
firebase init firestore
```

Select:
- "Use existing project" → Choose `kingqueen-c3543`
- "Rules file" → Accept default `firestore.rules`

### Step 4: Copy the rules above into `firestore.rules`

### Step 5: Deploy the rules
```bash
firebase deploy --only firestore:rules
```

## Production Recommendations

For production deployment, implement these additional security measures:

### 1. Admin Claims
Set up custom claims for admin users:

```javascript
// Cloud Function to set admin claims
const admin = require('firebase-admin');
admin.initializeApp();

exports.addAdminRole = functions.https.onCall(async (data, context) => {
  // Check if requester is already an admin
  const user = await admin.auth().getUser(context.auth.uid);
  if (!user.customClaims || !user.customClaims.admin) {
    throw new Error('Only existing admins can add new admins');
  }
  
  // Add admin claim to specified user
  await admin.auth().setCustomUserClaims(data.uid, { admin: true });
  
  return { message: `Success! ${data.uid} has been granted admin privileges.` };
});
```

### 2. Updated Production Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Players - Read public, Write admins only
    match /players/{playerId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if isAdmin();
    }
    
    // Matches - Read public, Update admins only
    match /matches/{matchId} {
      allow read: if true;
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // Settings - Admins only
    match /tournamentSettings/{settingId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

## Testing Rules

### Test Open Access (Development)
```bash
# Should succeed - reading players
curl "https://firestore.googleapis.com/v1/projects/kingqueen-c3543/databases/(default)/documents/players"

# Should succeed - updating a match (development)
curl -X PATCH "https://firestore.googleapis.com/v1/projects/kingqueen-c3543/databases/(default)/documents/matches/match123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"score1": 21}'
```

### Monitor Rule Violations
Check Firebase Console → Firestore → Logs to monitor any denied requests.

## Current App Configuration

Your app currently uses:
- **Project ID**: `kingqueen-c3543`
- **Collections**: `players`, `matches`, `finalMatches`, `tournamentSettings`
- **Access Level**: Open (development mode)

## Next Steps After Deployment

1. ✅ Test all features work correctly
2. ✅ Monitor Firestore logs for any permission issues
3. ⚠️ Before going live, update rules to restrict write access to admins only
4. 📊 Set up Firestore usage monitoring in Firebase Console
5. 🔐 Consider implementing admin custom claims for production

---

**Note**: These rules are configured for development/testing. Before launching publicly, implement proper admin authentication and restrict write operations to authorized users only.

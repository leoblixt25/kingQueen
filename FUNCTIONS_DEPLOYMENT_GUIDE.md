# 🔥 Firebase Cloud Functions Setup Guide

## Admin "Reset Everything" Feature

---

## 📋 What This Does

Creates a secure admin-only cloud function that:
1. **Deletes ALL Firebase Authentication users** (except admin account)
2. **Deletes ALL Firestore documents** in the "players" collection
3. **Protected by email verification** (only `leoblixt77@gmail.com` can call it)
4. **Requires confirmation flag** to prevent accidental triggers

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd functions
npm install
```

This installs:
- `firebase-admin` - Server SDK with admin privileges
- `firebase-functions` - Cloud Functions framework
- `typescript` - Type checking and compilation

---

### Step 2: Initialize Firebase Project (if not done)

```bash
cd ..
firebase use --add
```

Select your Firebase project from the list.

---

### Step 3: Test Locally (Optional)

```bash
cd functions
npm run serve
```

This starts the Firebase emulators for local testing.

---

### Step 4: Deploy to Firebase

```bash
firebase deploy --only functions
```

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/YOUR_PROJECT/overview
Function URL (resetEverything): https://REGION-YOUR_PROJECT.cloudfunctions.net/resetEverything
```

---

## 💻 Frontend Integration

### Add to Your React App

Create a new file: `src/utils/adminReset.ts`

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "@/config/firebase";

interface ResetResult {
  success: boolean;
  message: string;
  details: {
    usersDeleted: number;
    usersSkipped: number;
    documentsDeleted: number;
    errors: string[];
  };
}

/**
 * Call the reset-everything cloud function
 * Only works if admin is authenticated
 */
export const resetEverything = async (): Promise<ResetResult> => {
  try {
    // Verify admin is logged in
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("You must be logged in as admin to perform this action");
    }

    if (user.email !== "leoblixt77@gmail.com") {
      throw new Error("Only the admin can perform this action");
    }

    // Get functions instance
    const functions = getFunctions();
    
    // Create callable function reference
    const resetFunction = httpsCallable<
      { confirm: boolean },
      ResetResult
    >(functions, "resetEverything");

    // Call with confirmation
    const result = await resetFunction({ confirm: true });

    return result.data;
  } catch (error: any) {
    console.error("Reset failed:", error);
    throw error;
  }
};
```

---

### Admin Button Example

Add to your Admin Control panel:

```tsx
import { useState } from "react";
import { resetEverything } from "@/utils/adminReset";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function AdminResetButton() {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    
    try {
      const result = await resetEverything();
      
      toast({
        title: "✅ Reset Successful",
        description: result.message,
      });
      
      setShowConfirmation(false);
      
      // Optional: Redirect or reload
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "❌ Reset Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="destructive"
        onClick={() => setShowConfirmation(true)}
        disabled={isResetting}
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Reset Everything
      </Button>

      {showConfirmation && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold text-red-700">
            ⚠️ Confirm Full Reset
          </h3>
          <p className="text-sm text-red-600">
            This will:
          </p>
          <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
            <li>Delete ALL registered users (except admin)</li>
            <li>Delete ALL player data from Firestore</li>
            <li>Reset the entire tournament</li>
          </ul>
          <p className="text-sm font-semibold text-red-700">
            This action CANNOT be undone!
          </p>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                "Yes, Reset Everything"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🔒 Security Features

### 1. Email Verification
```typescript
// Only this email can call the function
const ADMIN_EMAIL = "leoblixt77@gmail.com";

if (callerEmail !== ADMIN_EMAIL) {
  throw new functions.https.HttpsError(
    "permission-denied",
    "Only the admin can perform this action."
  );
}
```

### 2. Authentication Required
```typescript
if (!context.auth) {
  throw new functions.https.HttpsError(
    "unauthenticated",
    "You must be logged in to perform this action."
  );
}
```

### 3. Confirmation Flag
```typescript
if (data.confirm !== true) {
  throw new functions.https.HttpsError(
    "invalid-argument",
    "Confirmation flag must be set to true."
  );
}
```

### 4. Logging
All operations are logged to Firebase Cloud Logging for audit trail.

---

## 📊 How It Works

### Step-by-Step Process:

```
1. Admin clicks "Reset Everything" button
   ↓
2. Frontend shows confirmation modal
   ↓
3. Admin confirms action
   ↓
4. Frontend calls cloud function with { confirm: true }
   ↓
5. Cloud Function verifies:
   ✓ User is authenticated
   ✓ User email matches admin email
   ✓ Confirmation flag is true
   ↓
6. Cloud Function deletes Auth users:
   - Lists all users (batch of 1000)
   - Skips admin account
   - Deletes each user
   ↓
7. Cloud Function deletes Firestore:
   - Queries all players collection
   - Batch deletes all documents
   ↓
8. Returns detailed result:
   - Number of users deleted
   - Number of documents deleted
   - Any errors encountered
   ↓
9. Frontend shows success/error message
```

---

## 🧪 Testing

### Test as Admin:

1. Log in as `leoblixt77@gmail.com`
2. Navigate to Admin Panel
3. Click "Reset Everything"
4. Confirm the action
5. Check Firebase Console:
   - Authentication → Users (should be 1 - the admin)
   - Firestore → players collection (should be empty)

### Test as Non-Admin (Should Fail):

1. Log in as any other user
2. Try to call the function
3. Should receive: "Only the admin can perform this action"

---

## 📝 Logs & Monitoring

### View Function Logs:

```bash
firebase functions:log
```

### Or in Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Functions" in the sidebar
4. Click on `resetEverything`
5. Click "Logs" tab

### Example Log Output:

```
🔴 Admin leo.blixt77@gmail.com initiated full reset
🔍 Step 1: Deleting Firebase Auth users...
✅ Deleted user: player1@example.com
✅ Deleted user: player2@example.com
⏭️  Skipped admin: leo.blixt77@gmail.com
✅ Auth cleanup complete: 15 deleted, 1 skipped
🔍 Step 2: Deleting Firestore players collection...
✅ Deleted 16 player documents
🎉 Reset completed successfully
```

---

## ⚠️ Important Notes

### Firebase Admin SDK Privileges

The cloud function runs with **Firebase Admin SDK**, which has **full access** to:
- All Firebase Authentication users
- All Firestore collections
- All Firebase services

This is why the function must be secured with:
- ✅ Email verification
- ✅ Authentication check
- ✅ Confirmation flag
- ✅ Audit logging

### Firestore Batch Delete Limit

Firebase batch operations can delete up to **500 documents** at a time. If you have more than 500 players, the function will need to be updated to use multiple batches.

Current player limit is 16 (8 male + 8 female), so the current implementation is sufficient.

### Auth Delete Rate Limit

Firebase Auth allows **1000 deletes per second**. The function processes users in batches of 1000, which is well within the limit.

---

## 🔧 Troubleshooting

### Error: "Only the admin can perform this action"

**Cause:** You're not logged in with the admin email.

**Solution:** 
1. Log out
2. Log in as `leoblixt77@gmail.com`
3. Try again

---

### Error: "You must be logged in to perform this action"

**Cause:** No authenticated user session.

**Solution:**
1. Log in first
2. Ensure your Firebase Auth session is active
3. Try again

---

### Error: "PERMISSION_DENIED: Missing or insufficient permissions"

**Cause:** Cloud Functions not deployed or Firebase project not configured.

**Solution:**
```bash
firebase deploy --only functions
```

---

### Error: "Functions not working after deployment"

**Solution:**
```bash
# Check if function exists
firebase functions:list

# Check logs
firebase functions:log

# Redeploy
firebase deploy --only functions
```

---

## 💰 Pricing

### Firebase Blaze Plan Required

Cloud Functions require the **Blaze (pay-as-you-go)** plan.

**Costs:**
- **2 million invocations/month** - FREE
- **400,000 GB-seconds** - FREE
- **200,000 GHz-seconds** - FREE

Since you'll use this function rarely, you'll stay well within the free tier.

### Upgrade to Blaze:

1. Go to [Firebase Console](https://console.firebase.firebase.google.com/)
2. Select your project
3. Click "Upgrade" in the sidebar
4. Choose "Blaze" plan
5. Add billing information

---

## 📁 File Structure

```
functions/
├── src/
│   └── index.ts          # Cloud function code
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── .gitignore            # Ignore node_modules, lib/
```

---

## 🎯 Next Steps

1. ✅ Install dependencies: `cd functions && npm install`
2. ✅ Deploy function: `firebase deploy --only functions`
3. ✅ Add frontend code to your admin panel
4. ✅ Test with admin account
5. ✅ Monitor logs for successful execution

---

## 📞 Support

If you encounter issues:

1. Check function logs: `firebase functions:log`
2. Verify admin email matches in both:
   - `functions/src/index.ts` (ADMIN_EMAIL constant)
   - Firebase Authentication (admin user email)
3. Ensure Blaze plan is active
4. Check Firebase Console for deployment status

---

**Happy Resetting! 🔥**


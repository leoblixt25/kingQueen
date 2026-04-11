# 🚨 URGENT: Deploy Firebase Cloud Function to Fix Reset Button

## Problem
The "Reset Everything" button is NOT deleting Firebase Authentication users because the Firebase Cloud Function has not been deployed yet.

## Solution - Deploy Now (5 minutes)

### Step 1: Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Navigate to functions directory and install dependencies
```bash
cd functions
npm install
cd ..
```

### Step 4: Deploy the Cloud Function
```bash
firebase deploy --only functions
```

### Step 5: Verify Deployment
After deployment, you should see:
```
✔  functions[resetEverything]: Successful create operation.
```

### Step 6: Test the Reset Button
1. Go to: https://sandy-scorekeeper.pages.dev/tournament
2. Login as admin: `leo.blixt77@gmail.com`
3. Click "Reset Everything"
4. Open browser console (F12) to see logs
5. Check Firebase Console > Authentication to verify users are deleted

---

## What the Cloud Function Does

When deployed, the `resetEverything` cloud function will:

1. ✅ Verify you're logged in as `leo.blixt77@gmail.com`
2. ✅ Delete ALL Firebase Authentication users EXCEPT your admin account
3. ✅ Delete ALL Firestore player documents
4. ✅ Return detailed results (users deleted, documents deleted)

The frontend then reinitializes with fresh placeholder players and matches.

---

## Troubleshooting

### Error: "Cloud function not deployed"
**Solution:** Run `firebase deploy --only functions`

### Error: "Only the admin can perform this action"
**Solution:** Make sure you're logged in as `leo.blixt77@gmail.com`

### Error: "You must be logged in"
**Solution:** Sign in to your admin account first

### Deployment fails
**Solution:** 
1. Make sure you're in the correct Firebase project: `firebase use kingqueen-c3543`
2. Check that you have Blaze plan (pay-as-you-go) enabled
3. Verify functions/src/index.ts exists and compiles: `cd functions && npm run build`

---

## Verify Cloud Function is Working

### Method 1: Browser Console
1. Open browser DevTools (F12)
2. Click "Reset Everything"
3. Look for these logs:
   ```
   🗑️ [RESET] Step 1: Calling Firebase Cloud Function to reset everything...
   🌐 [AUTH] Calling Firebase Cloud Function to delete users...
   ✅ [AUTH] Cloud function result: { success: true, ... }
   ```

### Method 2: Firebase Console
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select project: `kingqueen-c3543`
3. Go to Functions > Logs
4. Trigger the reset button
5. Check for function execution logs

### Method 3: Check Authentication
1. Go to Firebase Console > Authentication
2. Note the number of users
3. Click "Reset Everything"
4. Refresh Authentication page
5. Only `leo.blixt77@gmail.com` should remain

---

## Files Created/Updated

✅ `src/config/firebase.ts` - Added Functions initialization
✅ `src/utils/resetUtils.ts` - Updated to call cloud function
✅ `firebase.json` - Firebase configuration
✅ `.firebaserc` - Project ID configuration
✅ `functions/src/index.ts` - Cloud function code (already exists)

---

## Important Notes

⚠️ **Firebase Blaze Plan Required**
- Cloud Functions require the Blaze (pay-as-you-go) plan
- Free tier includes 2 million invocations/month
- Cost is minimal for reset operations

⚠️ **Admin Email Protected**
- `leo.blixt77@gmail.com` will NEVER be deleted
- Only non-admin users are deleted

⚠️ **Irreversible Action**
- All user authentication data will be permanently deleted
- All player data will be permanently deleted
- Make sure you really want to reset before clicking

---

## Quick Commands Reference

```bash
# Deploy functions only
firebase deploy --only functions

# View function logs
firebase functions:log

# Test locally (optional)
cd functions
npm run serve
```

---

## After Deployment

Once deployed, the cloud function will be available at:
```
https://<region>-kingqueen-c3543.cloudfunctions.net/resetEverything
```

The frontend automatically calls this function when you click "Reset Everything".

---

**Status:** ⏳ Waiting for you to deploy the cloud function
**Next Action:** Run `firebase deploy --only functions`

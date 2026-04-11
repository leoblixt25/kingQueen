# 🚀 Deploy Cloudflare Worker (100% FREE - No Blaze Plan Needed!)

## Why Cloudflare Workers?
- ✅ **Completely FREE** - 100,000 requests/day on free tier
- ✅ **No credit card required** for basic usage
- ✅ **Already using Cloudflare Pages** - same account!
- ✅ **Perfect for your use case** - reset button only called occasionally

---

## Step-by-Step Deployment (Using Cloudflare Dashboard - NO Commands!)

### Step 1: Get Firebase Service Account Key

1. Go to: https://console.firebase.google.com/
2. Click your project: **kingqueen-c3543**
3. Click **⚙️ Settings** (top left, next to Project Overview)
4. Click **"Project settings"**
5. Go to **"Service accounts"** tab
6. Click **"Generate new private key"**
7. Click **"Generate key"** to download the JSON file
8. **Keep this file secure** - you'll need it in Step 3

---

### Step 2: Create Cloudflare Worker

1. Go to: https://dash.cloudflare.com/
2. Login to your account
3. Click **"Workers & Pages"** in the left sidebar
4. Click **"Create application"**
5. Click **"Create Worker"**
6. Name it: `sandy-scorekeeper-workers`
7. Click **"Deploy"**

---

### Step 3: Add the Worker Code

1. After creating the worker, click **"Edit code"**
2. **Delete all the existing code** in the editor
3. **Copy the code** from your local file:
   - File: `workers/delete-firebase-users.ts`
   - Or I'll provide it below
4. **Paste the code** into the Cloudflare Worker editor
5. Click **"Save and Deploy"**

---

### Step 4: Add Firebase Service Account Secret

1. In your Worker dashboard, click **"Settings"** tab
2. Click **"Variables"** in the left sidebar
3. Under **"Environment Variables"**, click **"Add variable"**
4. Fill in:
   - **Variable name**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Open your Firebase service account JSON file and copy **ALL** the content (the entire JSON)
   - **Type**: Select **"Secret"** (encrypted)
5. Click **"Save and Deploy"**

---

### Step 5: Get Your Worker URL

After deployment, your worker URL will be:
```
https://sandy-scorekeeper-workers.leoblixt25.workers.dev
```

**IMPORTANT:** Copy this URL!

---

### Step 6: Update the URL in Your Code

1. Open file: `src/utils/resetUtils.ts`
2. Find line 66 (approximately)
3. Update the URL:
   ```typescript
   const workerUrl = 'https://sandy-scorekeeper-workers.leoblixt25.workers.dev';
   ```
4. Save the file
5. Commit and push to GitHub
6. Cloudflare Pages will auto-deploy your frontend

---

## 🎉 That's It! You're Done!

### Test It:
1. Go to: https://sandy-scorekeeper.pages.dev/tournament
2. Login as admin: `leo.blixt77@gmail.com`
3. Open browser console (F12)
4. Click "Reset Everything"
5. Watch the console logs:
   ```
   🗑️ [RESET] Step 1: Deleting Firebase Auth users via Cloudflare Worker...
   🌐 [AUTH] Calling Cloudflare Worker to delete users...
   ✅ [AUTH] Successfully deleted X users
   ✅ [RESET] Full tournament reset completed successfully
   ```

---

## 📋 Worker Code (If You Need It)

The code is already in your repository at:
- `workers/delete-firebase-users.ts`

Or you can copy it from GitHub after pushing.

---

## 🔒 Security Features

✅ **Admin-only access** - Only `leo.blixt77@gmail.com` can call this worker  
✅ **Token validation** - Verifies Firebase ID token  
✅ **Admin protection** - Your admin account will NEVER be deleted  
✅ **Encrypted secrets** - Service account stored as encrypted secret  
✅ **CORS enabled** - Works with your Cloudflare Pages frontend  

---

## 💰 Cost

**Cloudflare Workers Free Tier:**
- 100,000 requests per day
- You'll use maybe 1-10 requests per month
- **Cost: $0.00 (FREE!)**

---

## 🐛 Troubleshooting

### Error: "Unauthorized: Admin privileges required"
**Solution:** Make sure you're logged in as `leo.blixt77@gmail.com`

### Error: "Failed to delete users"
**Solution:** 
1. Check that the `FIREBASE_SERVICE_ACCOUNT` secret is set correctly
2. Verify the JSON is complete (starts with `{` and ends with `}`)
3. Check Worker logs in Cloudflare dashboard

### Error: Network error / CORS error
**Solution:**
1. Make sure the worker URL in `resetUtils.ts` is correct
2. Verify the worker is deployed and active
3. Check browser console for specific error messages

---

## 📊 Monitor Your Worker

1. Go to Cloudflare Dashboard
2. Click **"Workers & Pages"**
3. Click your worker: `sandy-scorekeeper-workers`
4. Click **"Logs"** tab to see execution logs
5. Check for errors or successful deletions

---

## ✅ Checklist

- [ ] Downloaded Firebase service account JSON
- [ ] Created Cloudflare Worker named `sandy-scorekeeper-workers`
- [ ] Pasted worker code
- [ ] Added `FIREBASE_SERVICE_ACCOUNT` secret
- [ ] Got worker URL
- [ ] Updated URL in `src/utils/resetUtils.ts`
- [ ] Pushed changes to GitHub
- [ ] Tested "Reset Everything" button
- [ ] Verified users are deleted in Firebase Console

---

**Status:** Ready to deploy!  
**Cost:** $0 (FREE!)  
**Time:** ~10 minutes  

---

## Need Help?

The worker code is already created and ready to deploy at:
- `workers/delete-firebase-users.ts`

Just follow the steps above and you'll have it working in no time! 🚀

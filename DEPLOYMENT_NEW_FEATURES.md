# Deployment Guide - New Features

## 🚀 Quick Deployment Steps

### Step 1: Push to GitHub (Manual)

Open **Git Bash** or **Command Prompt** in the `sandy-scorekeeper` directory and run:

```bash
# Navigate to project directory
cd sandy-scorekeeper

# Check what files changed
git status

# Add all new changes
git add .

# Commit with descriptive message
git commit -m "feat: Add pending approval registration system, admin approval workflow, and PDF export

- Add player status field (pending/approved/cancelled)
- Registration flow now requires admin approval
- Create pending approval page with auto-refresh
- Add pending registrations section to admin panel
- Implement approve button functionality
- Add PDF export for tournament matchups using jsPDF
- Update all player queries to filter by status='approved'
- Add database migration script for status field"

# Push to GitHub
git push origin main
```

### Step 2: Deploy to Firebase

Run the deployment script:

```bash
.\deploy.bat
```

Or deploy manually:

```bash
# Build the app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting --project kingqueen-c3543
```

### Step 3: Run Database Migration (CRITICAL!)

You MUST update existing players in Firestore to add the `status` field.

**Option A: Using Firebase Console (Manual)**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `kingqueen-c3543`
3. Go to **Firestore Database**
4. Open the `players` collection
5. For each player document:
   - If `is_confirmed: true` → Add field `status: "approved"`
   - If has email but `is_confirmed: false` → Add field `status: "pending"`
   - If placeholder (no email) → Add field `status: null` or omit

**Option B: Using Firebase Admin SDK (Automated)**

Create a file `migrate-status.js` in the project root:

```javascript
const admin = require('firebase-admin');

// Initialize with your service account
const serviceAccount = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migratePlayerStatus() {
  console.log('Starting migration...');
  
  const playersRef = db.collection('players');
  const snapshot = await playersRef.get();
  
  console.log(`Found ${snapshot.size} players`);
  
  let updateCount = 0;
  const batch = db.batch();
  
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const playerRef = playersRef.doc(docSnap.id);
    
    let status = null;
    
    if (data.is_confirmed === true) {
      status = 'approved';
    } else if (data.email && data.name && !data.name.includes('Player')) {
      status = 'pending';
    } else {
      status = null; // placeholder
    }
    
    batch.update(playerRef, { status: status });
    updateCount++;
    
    // Firestore batch limit is 500
    if (updateCount % 500 === 0) {
      batch.commit();
      console.log(`Updated ${updateCount} players`);
    }
  });
  
  await batch.commit();
  console.log(`✅ Migration complete! Updated ${updateCount} players total`);
}

migratePlayerStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
```

Then run:

```bash
npm install firebase-admin
node migrate-status.js
```

**Option C: Using Cloud Firestore Web Console (Quick Fix)**

If you have few players, just manually update them:

1. Open Firebase Console → Firestore
2. Click on each player document
3. Add field: `status` (string)
4. Set value based on:
   - Confirmed players: `"approved"`
   - Registered but not confirmed: `"pending"`
   - Placeholders: leave empty or `"null"`

---

## 📋 What Was Changed

### New Files Created:
1. `src/pages/PendingApproval.tsx` - Pending approval page
2. `src/utils/pdfExport.ts` - PDF export utility
3. `supabase/migrations/20260429000000_add_player_status_field.sql` - Migration script

### Files Modified:
1. `src/utils/authUtils.ts` - Registration sets status='pending'
2. `src/utils/placeholderUtils.ts` - Slot registration & unregistration updated
3. `src/pages/Register.tsx` - Redirects to pending-approval
4. `src/components/AdminPanel.tsx` - Added pending registrations & PDF export
5. `src/App.tsx` - Added pending-approval route
6. `src/hooks/useRegistrationCheck.ts` - Query updated to status='approved'
7. `src/pages/Index.tsx` - Query updated to status='approved'
8. `src/pages/PlayerAccess.tsx` - Query updated to status='approved'
9. `src/pages/AdminControl.tsx` - Query updated to status='approved'
10. `package.json` - Added jspdf & jspdf-autotable dependencies

---

## ✅ Post-Deployment Testing Checklist

### Test Registration Flow:
- [ ] Register a new player
- [ ] Verify redirect to /pending-approval
- [ ] Verify "Registration Pending Approval" message displays
- [ ] Verify player CANNOT access tournament pages

### Test Admin Approval:
- [ ] Login as admin (username: leo, password: Woodgoat22!!)
- [ ] Open Admin Panel
- [ ] Verify pending player appears in "Pending Registrations" section
- [ ] Check player details (name, email, gender, date)
- [ ] Click "Approve" button
- [ ] Verify player moves to "Confirmed Players" section
- [ ] Verify pending player auto-redirects to tournament (wait 5 sec)

### Test PDF Export:
- [ ] Login as admin
- [ ] Open Admin Panel
- [ ] Click "Export Matchups as PDF"
- [ ] Verify PDF downloads
- [ ] Open PDF and verify:
  - [ ] Tournament header with date
  - [ ] Female players list (coral theme)
  - [ ] Male players list (ocean theme)
  - [ ] Female match schedule
  - [ ] Male match schedule
  - [ ] Match scores and status
  - [ ] Clean, printable formatting

### Test Edge Cases:
- [ ] Access /pending-approval without registration → Shows "Not Found"
- [ ] Approve player from admin → Player auto-redirects within 5 seconds
- [ ] Unregister player → Status resets to null
- [ ] Register with existing email → Shows error
- [ ] Register when division is full → Shows error

---

## 🔧 Troubleshooting

### Issue: Players not showing in Pending Registrations
**Solution:** Run the database migration script to add `status` field to existing players

### Issue: PDF export fails
**Solution:** 
- Check browser console for errors
- Verify jspdf and jspdf-autotable are installed: `npm list jspdf jspdf-autotable`
- Reinstall if needed: `npm install jspdf jspdf-autotable`

### Issue: Approved players still can't access tournament
**Solution:**
- Clear browser cache and localStorage
- Verify player document has `status: "approved"` in Firestore
- Check browser console for query errors

### Issue: Build fails
**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📊 Player Status Flow

```
New Placeholder
  status: null
  is_confirmed: false
       ↓
  Player Registers
       ↓
Pending Registration
  status: "pending"
  is_confirmed: false
       ↓
  Admin Approves
       ↓
Approved Player
  status: "approved"
  is_confirmed: true
       ↓
  Can access tournament
```

---

## 🎯 Live URLs

After deployment:
- **App**: https://kingqueen-c3543.web.app
- **GitHub**: https://github.com/leoblixt25/sandy-scorekeeper
- **Firebase Console**: https://console.firebase.google.com/project/kingqueen-c3543

---

## 📝 Notes

- All existing `is_confirmed` queries have been updated to use `status: "approved"`
- Backward compatibility maintained: checks both `status === 'approved'` OR `is_confirmed === true`
- Auto-refresh on pending page checks every 5 seconds
- PDF uses client-side generation (no server needed)
- Email notification for approval is ready to implement (see AdminPanel.tsx TODO comment)

---

**Last Updated:** 2026-04-29

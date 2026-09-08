# 🚀 Quick Start - Deploy New Features

## ⚡ 3-Step Deployment

### Step 1: Push to GitHub
**Option A - Using Script (if Git is installed):**
```bash
.\push-to-github.bat
```

**Option B - Using GitHub Desktop (Recommended if Git not installed):**
1. Open GitHub Desktop
2. Open repository: `sandy-scorekeeper`
3. You'll see all changed files
4. Write commit message: "feat: Add pending approval & PDF export"
5. Click "Commit to main"
6. Click "Push origin"

**Option C - Manual Git Commands:**
```bash
cd sandy-scorekeeper
git add .
git commit -m "feat: Add pending approval registration, admin approval, and PDF export"
git push origin main
```

---

### Step 2: Deploy to Firebase
```bash
.\deploy.bat
```

Or manually:
```bash
npm run build
firebase deploy --only hosting --project kingqueen-c3543
```

**Live URL:** https://kingqueen-c3543.web.app

---

### Step 3: Run Database Migration ⚠️ CRITICAL

You MUST add the `status` field to existing players in Firestore.

**Quick Manual Method (for few players):**
1. Go to [Firebase Console](https://console.firebase.google.com/project/kingqueen-c3543/firestore)
2. Open `players` collection
3. For each player, add a `status` field:
   - If `is_confirmed = true` → set `status = "approved"`
   - If has real email → set `status = "pending"`
   - If placeholder (no email) → leave `status` empty or delete the field

**Automated Method (for many players):**
See full instructions in `DEPLOYMENT_NEW_FEATURES.md`

---

## ✅ Test After Deployment

1. **Test Registration:**
   - Register a new player
   - Should see "Registration Pending Approval" page
   - Should NOT access tournament yet

2. **Test Admin Approval:**
   - Login as admin
   - Open Admin Panel
   - See pending player in "Pending Registrations"
   - Click "Approve"
   - Player can now access tournament

3. **Test PDF Export:**
   - In Admin Panel, click "Export Matchups as PDF"
   - PDF should download with all players and matches

---

## 📁 Files Created/Modified

**New Files:**
- `src/pages/PendingApproval.tsx`
- `src/utils/pdfExport.ts`
- `push-to-github.bat`
- `DEPLOYMENT_NEW_FEATURES.md`

**Modified Files (10 files):**
- `src/utils/authUtils.ts`
- `src/utils/placeholderUtils.ts`
- `src/pages/Register.tsx`
- `src/components/AdminPanel.tsx`
- `src/App.tsx`
- `src/hooks/useRegistrationCheck.ts`
- `src/pages/Index.tsx`
- `src/pages/PlayerAccess.tsx`
- `src/pages/AdminControl.tsx`
- `package.json` (added jspdf, jspdf-autotable)

---

## 🆘 Need Help?

- **Git not working?** → Use GitHub Desktop
- **Firebase deploy fails?** → Run `firebase login` first
- **Players not showing?** → Run database migration
- **Build errors?** → Run `npm install` then `npm run build`

Full guide: See `DEPLOYMENT_NEW_FEATURES.md`

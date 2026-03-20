# Firebase Hosting Deployment Guide

## Prerequisites ✅
- Firebase project created: `kingqueen-c3543`
- All code migrated to Firebase (COMPLETE)
- Node.js installed

---

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

---

## Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

---

## Step 3: Initialize Firebase in Your Project

```bash
firebase init
```

**Select the following options:**

1. **Features**: Use spacebar to select:
   - ✅ Hosting: Configure files for Firebase Hosting
   - ✅ Firestore: Configure security rules (optional)

2. **Project Setup**: 
   - Select: `Use an existing project`
   - Choose: `kingqueen-c3543`

3. **Firestore Rules** (if selected):
   - File: `firestore.rules` (already created)

4. **Hosting Configuration**:
   - Public directory: `dist`
   - Configure as single-page app: `Yes`
   - Set up automatic builds: `No` (or Yes if using GitHub Actions)
   - Overwrite files: `No`

---

## Step 4: Build Your App

```bash
npm run build
```

This creates a `dist` folder with your production build.

---

## Step 5: Deploy to Firebase Hosting

### Deploy (Production)
```bash
firebase deploy --only hosting
```

### Deploy with Firestore Rules
```bash
firebase deploy --only hosting,firestore
```

---

## Step 6: View Your Deployed App

After deployment, you'll see:
```
✔ Deploy complete!

Hosting URL: https://kingqueen-c3543.web.app
```

Your app is now live! 🎉

---

## Alternative: Deploy to Other Platforms

### Option A: Netlify (Easy & Free)

1. **Connect to Git**:
   - Push your code to GitHub
   - Go to https://netlify.com
   - Click "New site from Git"
   - Select your repository

2. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Environment Variables**:
   ```
   VITE_FIREBASE_API_KEY=AIzaSyB59VBp3g79K0yYxcCmxwdp0mvgGTbdxxU
   VITE_FIREBASE_AUTH_DOMAIN=kingqueen-c3543.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=kingqueen-c3543
   VITE_FIREBASE_STORAGE_BUCKET=kingqueen-c3543.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=243756782404
   VITE_FIREBASE_APP_ID=1:243756782404:web:98d91f75b0e0c11d607d11
   ```

4. **Deploy!**

---

### Option B: Vercel (Fast & Free)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow prompts** to configure

4. **Set environment variables** in Vercel dashboard

---

### Option C: Railway (Full Stack)

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**:
   ```bash
   railway login
   ```

3. **Initialize**:
   ```bash
   railway init
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

---

## Post-Deployment Checklist

### 1. Test Core Features
- [ ] User registration works
- [ ] Google Sign-In works
- [ ] Score submission works
- [ ] Real-time updates functional
- [ ] Admin panel accessible
- [ ] Rankings display correctly

### 2. Firebase Console Checks
- [ ] Check Firestore Database for data
- [ ] Check Authentication for users
- [ ] Monitor usage in Firebase Console

### 3. Security (Production Only)
- [ ] Deploy production Firestore rules
- [ ] Enable admin custom claims
- [ ] Restrict write access to admins

---

## Environment Variables

Create `.env.production` file:

```env
VITE_FIREBASE_API_KEY=AIzaSyB59VBp3g79K0yYxcCmxwdp0mvgGTbdxxU
VITE_FIREBASE_AUTH_DOMAIN=kingqueen-c3543.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kingqueen-c3543
VITE_FIREBASE_STORAGE_BUCKET=kingqueen-c3543.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=243756782404
VITE_FIREBASE_APP_ID=1:243756782404:web:98d91f75b0e0c11d607d11
```

⚠️ **Never commit `.env.production` to Git!** Add to `.gitignore`.

---

## Continuous Deployment (Optional)

### GitHub Actions for Firebase

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: kingqueen-c3543
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Firebase Deploy Fails
```bash
# Check Firebase CLI version
firebase --version

# Update if needed
npm install -g firebase-tools@latest
```

### 404 Errors After Deploy
- Ensure SPA configuration is correct
- Check `dist` folder exists after build
- Verify `firebase.json` has correct settings

---

## Recommended: Quick Deploy Script

Create `deploy.sh` (Mac/Linux) or `deploy.bat` (Windows):

**Windows (deploy.bat):**
```batch
@echo off
echo Building app...
npm run build
if errorlevel 1 exit /b 1

echo Deploying to Firebase...
firebase deploy --only hosting
if errorlevel 1 exit /b 1

echo Deployment complete!
echo Visit: https://kingqueen-c3543.web.app
```

**Mac/Linux (deploy.sh):**
```bash
#!/bin/bash
echo "Building app..."
npm run build || exit 1

echo "Deploying to Firebase..."
firebase deploy --only hosting || exit 1

echo "Deployment complete!"
echo "Visit: https://kingqueen-c3543.web.app"
```

Make executable:
```bash
chmod +x deploy.sh
```

---

## Next Steps After Deployment

1. ✅ Test all features work correctly
2. ✅ Share URL with users
3. ✅ Monitor Firebase Console usage
4. ✅ Set up Google Analytics (optional)
5. ✅ Configure custom domain (optional)
6. ✅ Deploy production Firestore rules

---

**Ready to deploy?** Run:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

🚀 Your app will be live at: `https://kingqueen-c3543.web.app`

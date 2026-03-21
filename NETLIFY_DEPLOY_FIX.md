# Netlify Deployment Troubleshooting

## Current Issue
Site shows empty page at: https://kingaqueen.netlify.app/tournament

## Root Cause
The latest code has been pushed to GitHub but Netlify hasn't rebuilt yet OR there's a build/runtime error.

## Immediate Actions

### Option 1: Force Netlify Redeploy (RECOMMENDED)
1. Go to https://app.netlify.com/sites/kingaqueen/deploys
2. Click "Trigger deploy"
3. Select "Deploy site"
4. Wait 2-3 minutes for build to complete
5. Refresh https://kingaqueen.netlify.app/tournament

### Option 2: Check Build Logs
1. Go to Netlify Dashboard
2. Click on your site
3. Click "Deploys" tab
4. Click on the latest deploy
5. Check for build errors
6. Look for console errors in the log output

### Option 3: Clear Cache and Redeploy
1. In Netlify Dashboard
2. Go to Site settings → Build & deploy
3. Scroll to "Cached dependencies"
4. Click "Clear cache"
5. Trigger new deploy

## What to Check

### Browser Console Errors
Open browser DevTools (F12) → Console tab → Look for:
- ❌ Red error messages
- Firebase connection errors
- 404 errors for JS/CSS files
- "Cannot read property of undefined" errors

### Network Tab
Open browser DevTools (F12) → Network tab → Refresh:
- Check if index.html loads (status 200)
- Check if JS bundles load (no 404s)
- Check Firebase connection (no failed requests)

### Common Issues

#### Issue 1: Build Succeeds But Page Empty
**Symptom**: Build completes but page blank
**Cause**: React runtime error or Firebase config issue
**Fix**: Check browser console for specific error

#### Issue 2: Routing Issue
**Symptom**: /tournament URL shows 404 or blank
**Cause**: SPA redirect rules not working
**Fix**: Verify _redirects file in public folder

#### Issue 3: Environment Variables Missing
**Symptom**: Firebase not connecting
**Cause**: Missing .env variables in Netlify
**Fix**: Add environment variables in Netlify dashboard:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- etc.

#### Issue 4: Stale Build Cache
**Symptom**: Old code still showing after push
**Cause**: Netlify using cached dependencies
**Fix**: Clear cache (see Option 3 above)

## Quick Test Commands

```bash
# Build locally to verify no errors
npm run build

# Preview build locally
npm run preview

# Check dist folder exists
ls dist/

# Should see:
# - index.html
# - assets/
```

## Expected Behavior After Fix

✅ Loading screen appears briefly (< 5 seconds)
✅ Console shows: "🚀 [TOURNAMENT LOAD] Starting..."
✅ Console shows: "✅ [LOAD PLAYERS] Success: 16 players"
✅ Console shows: "✅ [LOAD MATCHES] Success: 28 matches"
✅ Matches display on page
✅ No red errors in console

## If Still Broken

1. **Share Console Errors**: Copy/paste ALL console logs
2. **Share Network Errors**: Screenshot of Network tab
3. **Share Netlify Build Log**: Link to failed deploy or error message
4. **Check Firebase**: Verify Firestore has data:
   - players collection (16 documents)
   - matches collection (28 documents)
   - tournamentSettings collection (1 document)

## Next Steps

After Netlify rebuilds:
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Open DevTools Console
3. Share any errors you see
4. We'll fix immediately based on error messages

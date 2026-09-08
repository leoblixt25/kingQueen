# PROJECT CONTEXT
## 0. TOKEN RULES (CRITICAL)

* Keep output short and direct
* Prefer code over explanation
* Do NOT repeat context or requirements
* Do NOT explain obvious things
* Modify only what is needed
* Output final solution only
* If solvable under 10 lines, do not exceed 10 lines

## 1. Project Overview

* Beach volleyball tournament tracker application
* Manages player registration, match scheduling, score tracking, and player rankings
* Admin panel for tournament configuration and management
* Real-time score updates and automatic ranking calculations

## 2. Tech Stack (FIXED - DO NOT CHANGE)

* **Version Control**: GitHub (repo `leoblixt25/kingQueen`)
* **Hosting/Deployment**: Firebase Hosting
* **Database**: Firebase Firestore
* **Auth**: Firebase Authentication
* **Frontend**: React + TypeScript + Vite
* **Styling**: Tailwind CSS

⚠️ THIS STACK IS FIXED. NEVER REPLACE OR MIGRATE THESE SERVICES.

## 3. Core Rules (CRITICAL)

* ❌ Do NOT replace Firebase with any other database
* ❌ Do NOT replace Firebase Hosting with any other hosting service (no Cloudflare)
* ❌ Do NOT replace GitHub with any other version control
* ❌ Do NOT introduce new backend services (AWS, Supabase, etc.)
* ❌ Do NOT change database structure unless explicitly requested
* ❌ Do NOT leave changes uncommitted to GitHub
* ❌ Do NOT make local changes without pushing to GitHub
* ✅ Always build on top of existing logic
* ✅ Always check existing code before making changes
* ✅ Assume Firebase is the only database solution and hosting platform
* ✅ Always commit and push changes to GitHub after each update

## 4. Editing Guidelines

* Make minimal, targeted changes
* Do not break existing features
* Keep code clean and simple
* Follow current code structure and patterns
* Reuse existing functions and utilities
* Test logic flow before implementing
* Do not introduce unnecessary complexity
* Preserve existing naming conventions

## 5. Common Patterns

* Ranking calculation: Triggered after match score updates
* Data loading: Uses Firebase queries with proper error handling
* State management: React hooks (useState, useEffect, custom hooks)
* Navigation: React Router with protected routes
* UI updates: Real-time data reload after database writes
* PDF export: Uses jsPDF with manual text/drawing (no autoTable plugin)
* Match grid layout (admin DrawPage): 5 matchups per row on desktop; PDF uses 2-column grid

## 6. How to Use This File

1. READ THIS FILE FIRST before any code edits or prompt responses
2. Understand the tech stack and constraints
3. Check existing code structure before proposing changes
4. Follow the core rules strictly
5. Make minimal changes that solve the specific problem
6. Verify changes don't break existing functionality
7. Commit and push all changes to GitHub after completion
8. Update this file every time you make changes to be up to date

## 7. Key Files Structure

```
KingQueen_EU/
├── src/
│   ├── components/     # React components
│   │   ├── AdminPanel.tsx       # Admin controls (approval, PDF export, settings)
│   │   ├── AdminControls.tsx    # Admin control buttons component
│   │   ├── PlayerReplacer.tsx   # Replace players functionality
│   │   ├── PlayerUnregistration.tsx # Player cancellation
│   │   ├── ResetConfirmationModal.tsx # Reset confirmation dialog
│   │   └── ScoreResetConfirmationModal.tsx # Score reset dialog
│   ├── hooks/          # Custom React hooks
│   │   ├── useTournamentData.ts     # Tournament data loading
│   │   ├── useTournamentActions.ts   # Tournament actions (reset, etc.)
│   │   └── useTournamentState.ts     # Tournament state management
│   ├── pages/          # Route pages
│   │   ├── Index.tsx            # Main tournament page
│   │   ├── AdminControl.tsx     # Admin configuration & controls
│   │   ├── DrawPage.tsx         # Tournament draw wheel (compact, live clock)
│   │   ├── PublicDrawPage.tsx   # Public draw view + countdown before start
│   │   ├── LiveRanking.tsx      # Live rankings display
│   │   ├── Landing.tsx          # Landing/home page (draw button = beach-gradient)
│   │   ├── PendingApproval.tsx  # Pending registration approval page
│   │   ├── InstallPage.tsx      # PWA install page
│   │   └── WaitingForDraw.tsx   # Waiting screen before draw
│   ├── utils/          # Utility functions (Firebase operations)
│   │   ├── pdfExport.ts         # PDF generation with football-style layout
│   │   ├── firebaseUtils.ts    # Firebase Firestore data loading (matches, players)
│   │   ├── resetUtils.ts       # Tournament reset functions
│   │   ├── matchSortUtils.ts   # Shared match sorting utilities (getOrderedMatches)
│   │   ├── matchPlayerResolver.ts # Resolves player IDs to Player objects in matches
│   │   ├── matchValidation.ts  # Match validation utilities
│   │   ├── matchInitUtils.ts    # Match initialization with deterministic IDs
│   │   ├── staticMatchups.ts    # SINGLE SOURCE OF TRUTH: 14 match combinations (Whist-8)
│   │   ├── rankingTiebreaker.ts # Tiebreaker calculation for rankings
│   │   ├── authUtils.ts         # Authentication and registration logic
│   │   └── placeholderUtils.ts  # Placeholder player management
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts     # Match, Player, ResolvedMatch types
│   └── config/         # Firebase configuration (firebase.ts — kingqueen-eu)
├── public/             # Static assets (manifest.json, sw.js service worker, auth/callback.html)
├── scripts/            # Local utilities (Delete-Players.bat one-click deletion)
├── scripts-firebase-tools/ # Standalone Firebase admin scripts (NO functions/ name!)
│   ├── delete-auth-users.mjs          # Local one-shot deletion (firebase-admin)
│   ├── delete-users-github-action.mjs # GitHub Actions deletion script (calls admin SDK)
│   └── migrate-data.mjs               # Firestore + Auth data migration script
├── .github/workflows/  # GitHub Actions workflows
├── firebase.json       # Hosting (site: kingqueen-eu) + firestore rules config
├── firestore.rules     # Firestore security rules
└── package.json        # Dependencies
```

## 8. Important Notes

* All database operations use Firebase Firestore
* Deploy to Firebase Hosting via `firebase deploy --only hosting --project kingqueen-eu`
* No server-side code or backend APIs
* Client-side ranking calculations after match updates
* Small delays may be needed for Firebase write completion
* Real-time subscriptions for live data updates
* All changes committed and pushed to GitHub (`leoblixt25/kingQueen`)

## 9. Player Registration System

### Player Status Flow
```
null (placeholder) → pending → approved
```

### Registration Process
1. Player registers with name, email, gender
2. Status set to `'pending'` (not `'approved'`)
3. Player redirected to `/pending-approval` page
4. Admin reviews and approves from Admin Panel
5. Status updated to `'approved'` + `is_confirmed: true`
6. Player gains access to tournament

### Key Fields
* `status`: `'pending'` | `'approved'` | `null`
* `is_confirmed`: boolean (legacy field, maintained for backward compatibility)
* `registered_at`: ISO timestamp
* `approved_at`: ISO timestamp (when admin approved)

## 10. PDF Export Features

### 3-Page Structure
* **Page 1**: Registered Players (side-by-side two-column layout)
* **Page 2**: Female Division matches
* **Page 3**: Male Division matches
* Each section starts on a new page with page header

### Layout Design
* Professional football-style match schedule
* 2-column grid layout (2 matches per row)
* Card-based design with rounded corners
* Clean, minimal, player-focused output

### Player Roster (Page 1)
* Side-by-side two-column layout under shared "Registered Players" heading
* Left column: Female Division (orange header, numbered 1-8)
* Right column: Male Division (blue header, numbered 1-8)
* Vertical divider between columns
* Players sorted alphabetically within each division

### Content Rules
* ✅ Player names only (NO emails)
* ✅ Match number (MATCH 1, MATCH 2, etc.)
* ✅ Team A vs Team B format
* ✅ Scores aligned to right (ONLY if completed)
* ✅ Names resolved via player objects (not IDs)
* ❌ NO "TBD" placeholder for incomplete matches
* ❌ NO score display if match not played

### Match Ordering (CRITICAL)
* `match_number` is coerced to `Number` at mapping stage in `firebaseUtils.ts`
* This prevents lexicographic sorting (1, 10, 11... 2, 3) when Firestore stores as string
* Shared `getOrderedMatches()` function used in both UI and PDF for consistency
* Sort: `Number(match_number ?? 9999) - Number(match_number ?? 9999)`
* ❌ NEVER rely on array index, insertion order, or object key order
* ❌ NEVER split/re-append matches without preserving order
* ❌ NEVER re-sort after initial getOrderedMatches call

### Data Flow for PDF
1. `firebaseUtils.loadMatches()` → raw matches with `player1_id` etc. (sorted by Number(match_number))
2. `matchPlayerResolver.resolveMatchPlayers()` → resolved matches with full Player objects
3. `Index.tsx` passes `resolvedFemaleMatches`/`resolvedMaleMatches` to `AdminPanel`
4. `AdminPanel` passes resolved matches to `exportMatchupsToPDF()`
5. `pdfExport.ts` applies `getOrderedMatches()` as final safety net before rendering

### Date Display
* Pulled from `tournamentSettings.tournament_date` in Firestore
* Formatted as: "Monday, January 15, 2026"
* Read-only (date editing in Tournament Configuration page only)
* Verified with console logging for debugging

### Division Organization
* Female Division (orange accent color: rgb(255, 127, 80))
* Male Division (blue accent color: rgb(0, 119, 182))
* Each division clearly separated with colored headers
* Matches sorted by match_number ascending (numeric)

### Match Card Structure
```
┌─────────────────────┐
│ MATCH 1             │
│ Player1 & Player2 10│
│        vs           │
│ Player3 & Player4 21│
└─────────────────────┘
```

## 11. Admin Panel Features

### Location
Admin Controls moved from Tournament page (Index.tsx) to AdminControl.tsx.
Admins now see all controls immediately after login.

### Removed Features
* ❌ Tournament Date Update (moved to Tournament Configuration page)
* ❌ `window.confirm()` popups (replaced with inline confirmation UI)
* ❌ Admin Controls section from Tournament page (moved to Admin page)

### Active Features (AdminControl.tsx)
* ✅ Configure Tournament (toggle settings panel)
* ✅ Registration Panel (open AdminPanel modal)
* ✅ Replace Players (open PlayerReplacer modal)
* ✅ Reset Scores Only (with confirmation modal)
* ✅ Reset Everything (with confirmation modal)
* ✅ Approve pending player registrations (inline confirmation)
* ✅ Move approved player back to pending (inline confirmation)
* ✅ Export tournament PDF (football-style layout)
* ✅ View player counts (male/female)
* ✅ Navigate to Tournament page

### Navigation
* Tournament page shows "← Back to Admin" button for admin users
* Draw page buttons navigate to /tournament (not /)
* Admin page has "View Tournament" button (placed between "Current Configuration" card and "Admin Controls" card)
* Admin page has "← Back to Home" button above the page title (navigates to /)

## 12. Match Generation System (Single Source of Truth)

### Architecture Overview
The match generation system ensures **consistent, deterministic matchups** between the draw wheel and saved tournament data.

### Single Source of Truth
* `staticMatchups.ts` → `STATIC_MATCHUPS` array contains exactly 14 match combinations
* All match generation flows through this one definition
* `generateMatchesFromOrder(playerOrder, gender)` creates matches from any player order
* Matches are generated ONCE in DrawPage, saved ONCE to Firestore, then ONLY read

### Match Data Format (Firestore)
```typescript
{
  id: string,
  match_number: number,
  gender: 'female' | 'male',
  player1_id: string,  // teamA[0]
  player2_id: string,  // teamA[1]
  player3_id: string,  // teamB[0]
  player4_id: string,  // teamB[1]
  score1: number,
  score2: number,
  is_completed: boolean
}
```

### Match Generation Flow
```
Draw Wheel:               Data Loading:
├─ Shuffle players        ├─ Load from collection(db, 'matches')
├─ Pre-generate 14        ├─ Map to teamA/teamB structure
│  matches ONCE           ├─ Validate all player IDs exist
├─ Animate wheel          └─ Return to UI (no regeneration)
│  (visualization only)
└─ Save exact matches
   to Firestore
```

### Key Functions
* `generateMatchesFromOrder()` - Single source of truth for match generation
* `shuffleArray()` - Fisher-Yates shuffle for randomization
* `loadMatches()` - ONLY loads matches from Firestore, NEVER generates
* `validateMatches()` - Strict validation of match data integrity

### Files Using Static Matchups
* `DrawPage.tsx` - Draw wheel (pre-generates matches, then visualizes)
* `staticMatchups.ts` - Match generation logic

### Critical Rules
❌ **NEVER** recompute or reshuffle matches after initial generation
❌ **NEVER** use drawn_*_matches or saved_*_matches for rendering
❌ **NEVER** silently fallback to generated matches if load fails
✅ Always use the pre-generated matches for display and storage
✅ Throw error if validation fails (no silent data loss)

## 13. Recent Changes (May 2026)

### PDF Export Fix for Test Players
* AdminControl.tsx now loads and resolves match data for PDF export
  - Added `loadMatchesData()` function to fetch matches from Firestore
  - Uses `buildPlayersMap()` and `resolveMatchPlayers()` to convert player IDs to Player objects
  - Passes resolved matches (with full player names) to AdminPanel
  - Fixes "UNKNOWN" player names in exported PDF when using test players

### DrawPage Redesign
* Removed large outer container box for full-width native app feel
* Match cards redesigned to match PDF export style exactly
  - Card header with "MATCH X" left-aligned
  - Two team rows (top blue #0077B6, bottom orange #FF7F50)
  - "VS" centered between teams
  - Solid backgrounds with white text
  - Rounded corners, subtle border, light shadow
* Responsive grid: Mobile 2, Tablet 3, Desktop 7 cards per row
* Wheel component unchanged

### DrawPage UI Refinements
* Wheel text positioning moved inward (r - 15) for better spacing from outer edge
* Match card player names center-aligned with increased font size (11px → 10px)
* Desktop layout: 7 cards per row with equal width distribution
* Reduced vertical spacing between wheel and matches (mt-8 → mt-4)
* Player names support wrapping instead of aggressive truncation
* Wider container (max-w-md → max-w-7xl) for better desktop readability
* Reduced card padding and internal spacing to maximize usable width

### Data Integrity & Empty Tournament Fix
* `loadTestPlayers()` now does FULL RESET before creating players
  - Deletes ALL matches (prevents ID mismatch)
  - Deletes ALL players
  - Resets tournamentSettings (draw_completed: false)
  - Creates fresh players with NEW IDs
* Added HARD SAFETY CHECK in Index.tsx
  - Throws CRITICAL ERROR if drawCompleted=true but no matches exist
  - Prevents silent empty states
* `loadMatches()` strictly loads from Firestore matches collection only
  - NO fallback to drawn_*_matches or saved_*_matches
  - STRICT validation with validateMatches()
  - Throws on validation failure

### Live Ranking Page Fix
* Fixed match structure mismatch
  - Changed from player1/player2/player3/player4 objects
  - To teamA[ids]/teamB[ids] structure (consistent with Match type)
* Updated rankingTiebreaker.ts to accept both Match[] and ResolvedMatch[]

### Navigation Fixes
* DrawPage.tsx: "Go to Tournament" and "Back to Tournament" buttons now navigate to /tournament (not /)
* Index.tsx (Tournament): Added "← Back to Admin" button for admin users

### UI Updates
* Male draw wheel colors updated to consistent ocean blues
* ResetConfirmationModal now accepts optional title/description/confirmText props

## 13c. Draw Recording REMOVED

* ❌ The draw-video recording system is **removed** — the admin screen-records the draw and shares via WhatsApp instead.
* ⚠️ Video storage via GitHub repo `leoblixt25/sandy-draw-videos` is NO LONGER USED.

## 13d. Admin Draw Page UI (Aug 2026)

* Compact single-line header: `[Female/Male Division badge] Tournament Draw` + live ticking date/time clock (pulses every second — proof the draw is real/live during screen recording)
* Wheel restored to original size (300px mobile / 320px desktop) with glow + colored shadow; player names drawn at ~17px inside segments
* Match grid: original card styling, **5 matchups per row** on desktop (14 matches per division — 8 players, STATIC_MATCHUPS)
* Wheel (left, sticky) + matchups (right) side-by-side grid so all matches stay visible while the wheel spins

## 13e. Public Draw Page Countdown (Aug 2026)

* "Not started yet" card shows a **live countdown** to the draw time
* Reads `tournament_date` from `tournamentSettings/default_settings`, target = **9pm (21:00) the day before the tournament** (e.g. Fri 21:00 when the tournament is Sat)
* Ticks every second; boxes for days / hours / minutes / seconds
* At zero: shows "The draw is starting now — refresh to watch live!"
* No countdown shown if `tournament_date` is unset
* Same 9pm-target countdown is used on `WaitingForDraw.tsx` for approved players

## 13g. Public Draw Page Division Tabs (Aug 2026)

* Female and Male draw results shown in **separate tabs** on the public draw page (same style as Live Ranking tabs: 👩 Female / 👨 Male)
* Only the active division's wheel + match grid renders
* The wheel paint effect depends on `activeTab` so the newly-mounted canvas is painted immediately on tab switch (otherwise it stays empty until a resize)

## 13h. Draw Save Name Collision Fix (Aug 2026)

* `DrawPage.tsx` `byName()` previously matched player names across ALL players and returned the first hit
* Bug: duplicate names (e.g. approved `male_8` "moon" + pending female reserve "moon") caused the wrong ID to be saved into matches → tournament page couldn't resolve the pending/reserve ID → stuck on "Loading Tournament Data..."
* Fix: `byName(name, gender)` now only matches **approved** players of the **same gender**

## 13i. Tournament Page Stability Fixes (Aug 2026)

* Blank/stuck tournament page after saving the draw was caused by render-time throws (no error boundary → blank page)
* Removed the `throw` in Index.tsx "HARD SAFETY CHECK" (draw completed but matches empty) — now logs CRITICAL ERROR only
* `resolveMatchPlayers()` is now guarded at the call site in `Index.tsx`: only resolves when the player map is non-empty, and wraps resolution in try/catch so a mismatch logs instead of blanking the page

## 13j. Approved-Player Waiting Page Fix (Aug 2026)

* `Index.tsx` auto-retry (reload tournament data when matches empty) is now gated on `drawCompleted` — while the draw is pending, empty matches are normal for approved players on `WaitingForDraw`, so retrying caused the page to blink between loading screen and countdown every few seconds
* `WaitingForDraw.tsx` top padding reduced (`pt-24` → `pt-12`) to move content up

## 13f. Landing Page (Aug 2026)

* Tournament Draw button now uses `bg-beach-gradient` (matches Live Ranking button style) instead of dark navy gradient
* Top spacing tightened: page `py-4`, ball `mb-4`, title `mb-6`, buttons `space-y-4` — ball/buttons moved up

## 13b. Registration Approval Name Masking

* Registered players only appear with their REAL name in rankings and matchups AFTER admin approval
* Before approval (`status === 'pending'`), the placeholder name (e.g. "Female Player 3") is shown
* Single source of truth: `getPublicDisplayName()` in `firebaseUtils.ts`
  * Returns real name only if `status === 'approved'` OR `is_confirmed === true`
  * Otherwise reconstructs placeholder name from `gender` + `position`
* Applied in:
  * `firebaseUtils.loadPlayers()` (both mapping paths) — feeds Index/tournament page
  * `LiveRanking.tsx` realtime snapshot handler
* DrawPage and AdminControl already filter `status === 'approved'` before loading
* Real-time subscription auto-refreshes names after approval (no reload needed)

## 13k. Player Account Deletion (Firebase Admin SDK) — WORKING

### Two deletion paths
1. **GitHub Actions** (`scripts-firebase-tools/delete-users-github-action.mjs`) — zero-dependency script (global fetch + node:crypto) invoked via `.github/workflows/delete-users.yml`. Verifies the caller's Firebase ID token with Google (Identity Toolkit) and aborts unless it belongs to `ADMIN_EMAIL`. Deletes ONLY Auth accounts except the admin. Never touches Firestore.
2. **Local one-shot** (`scripts/Delete-Players.bat` → `scripts-firebase-tools/delete-auth-users.mjs`) — uses firebase-admin, reads the service-account JSON from `%USERPROFILE%\Downloads\`. Proven: deleted 24 accounts flawlessly.

### Required secrets (rotate periodically)
* Repo Actions secret `FIREBASE_SERVICE_ACCOUNT_JSON` — full service-account JSON contents
* Local `.bat` reads key JSON from `%USERPROFILE%\Downloads\<service-account-file>.json`

### Cloudflare Worker relay (for the new EU app)
* Worker **`sandy-scorekeeper-workers`** live at `https://sandy-scorekeeper-workers.leo-blixt77.workers.dev` relays the "Delete All Registered Players" request from the browser to GitHub Actions (`repository_dispatch`).
* The worker verifies the caller's Firebase ID token with Google then dispatches to GitHub. **Source is NOT in this repo** — it's edited directly in the Cloudflare dashboard (Quick Edit).
* Deployed worker code must contain (edit these constants in the Cloudflare Quick Edit editor — they are separate from the Settings Variables):
  * `GITHUB_REPO = 'leoblixt25/kingQueen'` (was `sandy-scorekeeper` after EU migration)
  * `ADMIN_EMAIL = 'leo.blixt77@gmail.com'`
  * `WEB_API_KEY = 'AIzaSyBmLIUYNdvR1DIlVPjVpkU003zC6UyRzgY'` (the **EU** project key — the old `AIzaSyB59...` key caused "Unauthorized: Invalid or expired token")
* Cloudflare Worker Settings → Variables and Secrets:
  * `GH_PAT` — GitHub PAT able to `repository_dispatch` on `kingQueen` (fine-grained: Actions write).
  * (A `FIREBASE_SERVICE_ACCOUNT` variable also exists but is NOT used by the deletion verification path — the worker uses `WEB_API_KEY` instead.)

### EU migration deltas (verified working Sep 2026)
* Repo moved `leoblixt25/sandy-scorekeeper` → `leoblixt25/kingQueen`. The workflow file + script now live in `kingQueen` and the dispatch goes to `kingQueen`.
* Secret `FIREBASE_SERVICE_ACCOUNT_JSON` set in `leoblixt25/kingQueen` (service account `kingqueen-eu-firebase-adminsdk-fbsvc-246e9b4a36.json`).
* `delete-users-github-action.mjs` uses `PROJECT_ID='kingqueen-eu'` and `WEB_API_KEY='AIzaSyBmLIUYNdvR1DIlVPjVpkU003zC6UyRzgY'`.

### Gotchas (CRITICAL)
* ❌ **NEVER create a `functions/` directory at repo root** — it breaks the build. Local scripts live in `scripts-firebase-tools/`.
* `projects.accounts:batchGet` is a **GET** method (query params). POSTing it returns Google's HTML 404 page.
* `accounts:batchDelete` body uses camelCase **`localIds`** (legacy lowercase `localids` → LOCAL_ID_LIST_EXCEEDS_LIMIT 400).
* Old frontend cached in browser can fake "Success" — always hard-refresh / incognito when testing deploys.
* Changing `GITHUB_REPO`/`WEB_API_KEY` in the Cloudflare worker requires editing the **code constants** in Quick Edit AND pressing **Save and Deploy** (Settings-only variable changes do NOT fix token/repo errors). Wait ~60s for edge propagation.

## 13l. PDF Export Updates (Aug 2026)

### Final Standings fix
* Firestore players store snake_case `total_scores`; export previously read camelCase only → scores missing/wrong order
* Shared ranking comparator exported from pdfExport.ts: points desc → total_scores desc → id compare (use everywhere)

### Championship Final page (new last page)
* Data: `finalMatches/current` doc — team1_set1..3, team2_set2..3, winner_team, male_king_id/female_queen_id/male_prince_id/female_princess_id
* Bracket mapping: Team 1 = Male#1 + Female#2, Team 2 = Male#2 + Female#1; royal IDs remapped to bracket sides based on winner_team
* Gold-themed cards + CHAMPIONS badge + Honours panel (King/Queen/Prince/Princess); names resolved by stored IDs with ranking fallbacks

### Filename
* `King-Queen-<CitySanitized>-<YYYY-MM-DD>.pdf` (city from tournament settings via new optional `tournamentCity` export param)

## 13m. Switch-Off UX + Reset Everything Cleanup (Aug 2026)

* `/player-access` now renders `TournamentFinished` when Switch Off Mode is on (same gate as LiveRanking/PublicDrawPage). Signed-in registered players still auto-redirect, but their destination pages respect the switch-off too.
* ❌ Browser `window.confirm()` popups are being phased out (blocked by some browsers). Replaced with in-app `ResetConfirmationModal` instances:
  * **Switch Off Tournament Mode** (AdminControl) — explains pages get disabled, nothing deleted, restorable.
  * ✅ **Delete All Registered Players** (AdminControl) — exact warning text preserved; confirm button "Delete All".
  * ✅ **Final Match Reset** (Index) — "Reset Final Match?" with description of what gets cleared.
  * ✅ **Restart Draw** (DrawPage) — "Restart Draw?" with warning about clearing all match data.
  * ✅ All browser `window.confirm()` popups in the app are now replaced — none remain.
* **Reset Everything** (`fullTournamentReset` in resetUtils.ts) now ALSO:
  * Clears `tournamentSettings/settings` draw state: `draw_completed:false`, empty `drawn_*_matches`/`saved_*_matches`, live-mirror fields reset to idle — otherwise the public draw page kept showing stale matchups forever
  * Sets `tournament_status:'active'` so public pages are visible again for the new season
  * Clears `tournamentSettings/default_settings.tournament_date` (no stale countdown from last season)
* PublicDrawPage pre-draw view now has three states:
  * No confirmed date → "**The draw is not ready yet.** Once the tournament day is confirmed, the countdown for the draw will appear here."
  * Date set & upcoming → countdown boxes (unchanged)
  * Date reached → "draw is starting now" pulse pill (unchanged)
* Countdown reappears automatically once a new date is saved via Configure Tournament.

## 13n. PWA + Install Page (Aug 2026)

* App is now a **Progressive Web App (PWA)** — users can "Add to Home Screen" on iOS/Android and it behaves like a native app (full screen, home screen icon, offline shell cache).
* Service worker (`public/sw.js`) uses **network-first** strategy: normal speed when online, falls back to cached shell only when offline. Firebase API traffic is never intercepted or cached.
* `public/manifest.json` defines app name, icon (`icon.png`), theme color (`#0077B6`), standalone display mode.
* `index.html` updated with manifest link, `theme-color` meta, `apple-mobile-web-app-capable` meta.
* **`/install` page** (`src/pages/InstallPage.tsx`): platform-aware install page with:
  * Android → one-tap install via `beforeinstallprompt` (native browser prompt, single button)
  * iOS → step-by-step visual guide with Share button icon
  * Desktop → QR code (via `api.qrserver.com`) for scanning with phone camera
* Service worker registration is production-only (`import.meta.env.PROD`) so dev/hot-reload is unaffected.

## 13o. Spot Counter + Reserve Position UX (Aug 2026)

* Registration page spots display changed from "X / Y spots" to "**X spots available**" (simpler, less confusing).
* Spots count **only approved players** — pending registrations don't reduce the available count (was a bug during earlier refactors).
* Spots refresh every 5 seconds via `setInterval` + `getDocs` polling (real-time `onSnapshot` approach was attempted but failed silently — Firestore composite index issue on the `where('gender','==',...)` query).
* **Reserve position** shown in:
  * Toast messages after registration: "Your position: #2 on the waiting list"
  * **Pending-approval page** (`PendingApproval.tsx`): calculates position by counting existing reserve players of same gender + 1, displayed as "Your position on the waiting list: **#2**"
* `reserve_count` field added to `AvailableSpots` interface in Register.tsx — used for position calculation only, not for display on spots cards.

## 13p. Whist-8 Match Generation (Aug 2026)

* `STATIC_MATCHUPS` in `src/utils/staticMatchups.ts` replaced with a **verified cyclic Whist-8 (Wh(8)) matrix**.
* **14 matches across 7 rounds × 2 courts** — same match count as before, mathematically balanced:
  * Every player partners with each other player exactly **1 time**
  * Every player opposes each other player exactly **2 times**
  * Each player plays in exactly **7 matches**
* Draw process unchanged: Fisher-Yates shuffle → `generateMatchesFromOrder()` → same `GeneratedMatch[]` output → same Firestore schema.
* `GeneratedMatch` now includes optional `round` and `court` fields (backward-compatible — existing consumers ignore them).
* `verifyWhist8Integrity()` exported from `staticMatchups.ts` — verifies all 4 guarantees programmatically.
* Standalone check script: `scripts/verify-whist8.ts` (run via `npx tsx scripts/verify-whist8.ts`).
* All existing consumers (`DrawPage.tsx`, `firebaseMigration.ts`, `tournamentReset.ts`, `matchInitUtils.ts`) work unchanged — they iterate `STATIC_MATCHUPS` with the same `[p1,p2,p3,p4]` destructuring pattern.

## 14. Deployment URLs

### EU Project (KingQueen_EU — LIVE)
* **Firebase Hosting**: https://kingqueen-eu.web.app
* **Firebase Project**: `kingqueen-eu` (europe-west1, lower latency for Barcelona users)
* **GitHub Repository**: https://github.com/leoblixt25/kingQueen
* **Local folder**: `C:\Users\leobl\OneDrive\Documents\King_Queen_8_2026\KingQueen_EU`

### EU Deployment Commands
```bash
# Build
npm run build

# Deploy EU to Firebase Hosting
firebase deploy --only hosting --project kingqueen-eu

# Deploy EU Firestore rules
firebase deploy --only firestore:rules --project kingqueen-eu

# Push to EU repo
git push origin main
```

⚠️ **Directive**: This is the ONLY app repo. All work happens in `KingQueen_EU` local + `kingQueen` GitHub repo.

⚠️ **Migration done**: All Firestore data (16 players, 28 matches, 24 tournamentSettings) and the single admin auth user migrated from `kingqueen-c3543` to `kingqueen-eu` via `scripts-firebase-tools/migrate-data.mjs`. Service-account JSON keys are NOT stored in the repo — re-generate as needed (`firebase deploy` uses interactive `firebase login`).

⚠️ `DEPLOY_CLOUDFLARE_WORKER_FREE.md`, `FUNCTIONS_DEPLOYMENT_GUIDE.md` and other older guides describe the ABANDONED direct-worker / Firebase Functions approaches. The working architecture is section 13k.

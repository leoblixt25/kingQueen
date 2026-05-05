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

* **Version Control**: GitHub
* **Hosting/Deployment**: Cloudflare Pages
* **Database**: Firebase Firestore
* **Frontend**: React + TypeScript + Vite
* **Styling**: Tailwind CSS

⚠️ THIS STACK IS FIXED. NEVER REPLACE OR MIGRATE THESE SERVICES.

## 3. Core Rules (CRITICAL)

* ❌ Do NOT replace Firebase with any other database
* ❌ Do NOT replace Cloudflare with any other hosting service
* ❌ Do NOT replace GitHub with any other version control
* ❌ Do NOT introduce new backend services (AWS, Supabase, etc.)
* ❌ Do NOT change database structure unless explicitly requested
* ❌ Do NOT leave changes uncommitted to GitHub
* ❌ Do NOT make local changes without pushing to GitHub
* ✅ Always build on top of existing logic
* ✅ Always check existing code before making changes
* ✅ Assume Firebase is the only database solution
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
* Match grid layout: 2-column grid for professional sports schedule appearance

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
sandy-scorekeeper/
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
│   │   ├── DrawPage.tsx         # Tournament draw wheel
│   │   ├── LiveRanking.tsx      # Live rankings display
│   │   ├── Landing.tsx          # Landing/home page
│   │   ├── PendingApproval.tsx  # Pending registration approval page
│   │   └── WaitingForDraw.tsx   # Waiting screen before draw
│   ├── utils/          # Utility functions (Firebase operations)
│   │   ├── pdfExport.ts         # PDF generation with football-style layout
│   │   ├── firebaseUtils.ts    # Firebase Firestore data loading (matches, players)
│   │   ├── resetUtils.ts       # Tournament reset functions
│   │   ├── matchSortUtils.ts   # Shared match sorting utilities (getOrderedMatches)
│   │   ├── matchPlayerResolver.ts # Resolves player IDs to Player objects in matches
│   │   ├── matchValidation.ts  # Match validation utilities
│   │   ├── matchInitUtils.ts    # Match initialization with deterministic IDs
│   │   ├── staticMatchups.ts    # SINGLE SOURCE OF TRUTH: 14 match combinations
│   │   ├── rankingTiebreaker.ts # Tiebreaker calculation for rankings
│   │   ├── authUtils.ts         # Authentication and registration logic
│   │   └── placeholderUtils.ts  # Placeholder player management
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts     # Match, Player, ResolvedMatch types
│   └── config/         # Firebase configuration
├── public/             # Static assets
├── supabase/           # Database migrations (for reference)
└── package.json        # Dependencies
```

## 8. Important Notes

* All database operations use Firebase Firestore
* No server-side code or backend APIs
* Client-side ranking calculations after match updates
* Small delays may be needed for Firebase write completion
* Real-time subscriptions for live data updates
* All updates must be committed and pushed to GitHub to trigger deployment

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
* ✅ Export tournament PDF (football-style layout)
* ✅ View player counts (male/female)
* ✅ Navigate to Tournament page

### Navigation
* Tournament page shows "← Back to Admin" button for admin users
* Draw page buttons navigate to /tournament (not /)
* Admin page has "View Tournament" button

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

## 14. Deployment URLs

* **Cloudflare Pages**: https://sandy-scorekeeper.pages.dev/
* **Firebase Hosting**: https://kingqueen-c3543.web.app
* **GitHub Repository**: https://github.com/leoblixt25/sandy-scorekeeper

### Deployment Commands
```bash
# Build
npm run build

# Deploy to Firebase Hosting
npx firebase deploy --only hosting

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name sandy-scorekeeper --branch main --commit-dirty=true

# Push to GitHub
git add -A
git commit -m "message"
git push origin main
```

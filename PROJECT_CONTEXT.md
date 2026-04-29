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
│   │   └── AdminPanel.tsx      # Admin controls (approval, PDF export, settings)
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Route pages
│   │   ├── PendingApproval.tsx  # Pending registration approval page
│   │   └── Index.tsx            # Main tournament page
│   ├── utils/          # Utility functions (Firebase operations)
│   │   ├── pdfExport.ts         # PDF generation with football-style layout
│   │   ├── authUtils.ts         # Authentication and registration logic
│   │   └── placeholderUtils.ts  # Placeholder player management
│   ├── types/          # TypeScript type definitions
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

### Layout Design
* Professional football-style match schedule
* 2-column grid layout (2 matches per row)
* Card-based design with rounded corners
* Clean, minimal, player-focused output

### Content Rules
* ✅ Player names only (NO emails)
* ✅ Match number (MATCH 1, MATCH 2, etc.)
* ✅ Team A vs Team B format
* ✅ Scores aligned to right (ONLY if completed)
* ❌ NO "TBD" placeholder for incomplete matches
* ❌ NO score display if match not played

### Date Display
* Pulled from `tournamentSettings.tournament_date` in Firestore
* Formatted as: "Monday, January 15, 2026"
* Read-only (date editing in Tournament Configuration page only)
* Verified with console logging for debugging

### Division Organization
* Female Division (orange accent color: rgb(255, 127, 80))
* Male Division (blue accent color: rgb(0, 153, 204))
* Each division clearly separated with colored headers
* Matches sorted by match_number ascending

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

### Removed Features
* ❌ Tournament Date Update (moved to Tournament Configuration page)

### Active Features
* ✅ Approve pending player registrations
* ✅ Export tournament PDF (football-style layout)
* ✅ Initialize tournament database
* ✅ Reset players to placeholders
* ✅ Remove players from tournament
* ✅ View player counts (male/female)

## 12. Deployment URLs

* **Cloudflare Pages**: https://sandy-scorekeeper.pages.dev/
* **Firebase Hosting**: https://kingqueen-c3543.web.app
* **GitHub Repository**: https://github.com/leoblixt25/sandy-scorekeeper

### Deployment Commands
```bash
# Build
npm run build

# Deploy to Firebase
firebase deploy --only hosting --project kingqueen-c3543

# Push to GitHub (triggers Cloudflare deploy)
git add .
git commit -m "message"
git push origin main
```

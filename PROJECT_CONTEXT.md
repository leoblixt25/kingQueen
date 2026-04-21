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

## 6. How to Use This File

1. READ THIS FILE FIRST before any code edits or prompt responses
2. Understand the tech stack and constraints
3. Check existing code structure before proposing changes
4. Follow the core rules strictly
5. Make minimal changes that solve the specific problem
6. Verify changes don't break existing functionality
7. Commit and push all changes to GitHub after completion

## 7. Key Files Structure

```
sandy-scorekeeper/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Route pages
│   ├── utils/          # Utility functions (Firebase operations)
│   ├── types/          # TypeScript type definitions
│   └── config/         # Firebase configuration
├── public/             # Static assets
└── package.json        # Dependencies
```

## 8. Important Notes

* All database operations use Firebase Firestore
* No server-side code or backend APIs
* Client-side ranking calculations after match updates
* Small delays may be needed for Firebase write completion
* Real-time subscriptions for live data updates
* All updates must be committed and pushed to GitHub to trigger deployment

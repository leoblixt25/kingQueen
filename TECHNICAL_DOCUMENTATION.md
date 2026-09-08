# King & Queen of the Beach - Technical Documentation

**Version:** 2.1  
**Last Updated:** April 22, 2026  
**Tech Stack:** React + Vite + TypeScript + Firebase + Cloudflare Pages

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [Features List](#2-features-list)
3. [Authentication System](#3-authentication-system)
4. [Database Structure (Firestore)](#4-database-structure-firestore)
5. [Core Logic](#5-core-logic)
6. [Champion Final System](#6-champion-final-system)
7. [Deterministic Tiebreaker System](#7-deterministic-tiebreaker-system)
8. [App Flow](#8-app-flow)
9. [Functions & Key Code Logic](#9-functions--key-code-logic)
10. [Security & Access Control](#10-security--access-control)
11. [UI Structure](#11-ui-structure)
12. [Deployment Setup](#12-deployment-setup)
13. [Improvements & Future Enhancements](#13-improvements--future-enhancements)

---

## 1. App Overview

### App Name
**King & Queen of the Beach** - Beach Volleyball Tournament Tracker

### Purpose
A web application for managing and tracking a beach volleyball tournament with separate male and female divisions. The app handles player registration, match creation, score tracking, and real-time rankings.

### Target Users
- **Players**: Registered participants who can view matchups, submit scores, and track rankings
- **Admins**: Tournament organizers who can manage players, create matches, reset tournament data, and control all aspects

### Key Characteristics
- Single-tournament focus (King & Queen format)
- Limited slots: 8 players per gender division
- Real-time updates via Firebase
- Static hosting on Cloudflare Pages
- No backend server required

---

## 2. Features List

### Player Registration System
- **Limited Slots**: Maximum 8 players per gender division (16 total)
- **Registration Methods**:
  - Google Sign-In (OAuth)
  - Email + Password authentication
- **Slot-Based Registration**: Uses placeholder system to reserve positions
- **Auto-Confirmation**: New registrations are immediately confirmed
- **Duplicate Prevention**: Same email cannot register twice
- **Gender Selection**: Players choose Male or Female division

### Authentication & Access Control
- **Firebase Authentication**: Secure user management
- **Protected Routes**: Only registered players can access tournament pages
- **Role-Based Access**: Separate admin controls
- **Session Persistence**: Remembers logged-in users

### Match Management
- **Matchup Display**: Visual bracket showing player matchups
- **Match Creation**: Admin can create/initialize matches
- **Score Submission**: Players can submit scores for their matches
- **Match Status**: Visual indicators for completed/pending matches

### Ranking System
- **Points Calculation**:
  - Win: 2 points
  - Loss: 1 point
  - No-show: 0 points
- **6-Level Deterministic Tiebreaker System**:
  1. Total points (highest first)
  2. Total score (highest first)
  3. Point differential (scored - conceded, highest first)
  4. Head-to-head record (wins, then score difference)
  5. Strength of opponents (sum of opponents' points)
  6. Final fallback: Player ID (lexicographically smallest)
- **Tiebreaker Indicators**: Visual labels showing which rule decided tied rankings
- **Real-Time Updates**: Rankings update automatically when scores are submitted
- **Division Separation**: Separate rankings for Male and Female divisions

### Match Progress Tracking
- **Live Ranking Counter**: Displays "Match X/14 finished" for each division
- **Status Indicators**: Green blinking dot (in progress) or red dot (complete)
- **Auto-Advance**: After score submission, automatically moves to next unfinished match
- **Division-Specific State**: Separate localStorage keys per gender division
- **Landing Page Button**: Live Ranking button shows tournament progress status

### Admin Controls
- **Player Management**: View all registered players
- **Database Reset**: Reset entire tournament (players, matches, scores)
- **Match Initialization**: Create/modify match brackets
- **Player Replacement**: Replace no-show players
- **Unregistration**: Allow players to unregister before deadline
- **Tournament Configuration**: Configure tournament date, city, and settings via admin panel
- **Admin Navigation**: "Configure Tournament" button in Admin Controls section navigates to `/admin/control`

### Payment Integration (Optional)
- Stripe payment processing for registration fees
- Payment intent creation
- Payment status tracking

---

## 3. Authentication System

### Overview
The app uses Firebase Authentication with two sign-in methods, both linking to the same Firestore player records.

### Google Sign-In Flow

```
User clicks "Sign in with Google"
  ↓
Firebase OAuth popup opens
  ↓
User authenticates with Google
  ↓
Firebase Auth creates/updates user account
  ↓
Check Firestore "players" collection for matching email
  ↓
If found → Load player data
If new → Complete registration form
  ↓
Redirect to tournament page
```

**Implementation:**
```typescript
// src/utils/authUtils.ts
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if already registered in tournament
    const playerData = await checkTournamentRegistration(user.email);
    
    return {
      success: true,
      user,
      isRegistered: !!playerData?.isConfirmed
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Email + Password Authentication Flow

#### Registration:
```
User fills form: name, email, password, gender
  ↓
Firebase Auth creates account (createUserWithEmailAndPassword)
  ↓
Find next available placeholder slot
  ↓
Update placeholder document with player info:
  - Replace "Male Player 1" with actual name
  - Set email, is_confirmed = true
  ↓
Store auth credentials in localStorage
  ↓
Redirect to tournament page
```

**Implementation:**
```typescript
// src/utils/authUtils.ts
export const registerWithEmailPassword = async (
  email: string,
  password: string,
  name: string,
  gender: string
) => {
  // 1. Create Firebase Auth account
  const userCredential = await createUserWithEmailAndPassword(
    auth, 
    email.toLowerCase(), 
    password
  );
  
  // 2. Find available placeholder slot
  const placeholder = await getNextAvailablePlaceholder(gender);
  
  // 3. Update placeholder with real player info
  await updateDoc(doc(db, 'players', placeholder.id), {
    name: name.trim(),
    email: email.toLowerCase(),
    is_confirmed: true,
    registered_at: new Date().toISOString()
  });
  
  return { success: true, user: userCredential.user };
};
```

#### Login:
```
User enters email + password
  ↓
Firebase Auth verifies credentials
  ↓
Query Firestore "players" collection by email field
  ↓
Load player data if exists
  ↓
Redirect to tournament page
```

**Implementation:**
```typescript
// src/utils/authUtils.ts
export const signInWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(
    auth, 
    email.toLowerCase(), 
    password
  );
  
  const playerData = await checkTournamentRegistration(email);
  
  return {
    success: true,
    user: userCredential.user,
    isRegistered: !!playerData?.isConfirmed
  };
};
```

### User Storage Architecture

**Firebase Authentication:**
- Stores: uid, email, password hash, displayName, metadata
- Used for: Login/logout, session management
- Independent of registration status

**Firestore "players" Collection:**
- Stores: Player tournament data (name, email, gender, points, score)
- Document ID: Auto-generated (placeholder system)
- Email stored as FIELD, not document ID
- Linked via: email address matching

**Key Relationship:**
```
Firebase Auth User          Firestore Player Document
├─ uid: "abc123"           ├─ id: "xyz789" (placeholder ID)
├─ email: "john@example.com" ├─ email: "john@example.com" ← LINK
├─ displayName: "John"     ├─ name: "John Doe"
└─ provider: "password"    ├─ gender: "male"
                           ├─ points: 2
                           ├─ score: 21
                           └─ is_confirmed: true
```

---

## 4. Database Structure (Firestore)

### Collection: `players`

Stores all registered players (both divisions).

**Document Structure:**
```typescript
{
  // Identity
  uid: string;              // Firebase Auth user ID
  name: string;             // Player's full name
  email: string;            // Email address (lowercase)
  gender: "male" | "female"; // Division
  
  // Tournament Stats
  points: number;           // Ranking points (win=2, loss=1)
  score: number;            // Total points scored (tie-breaker)
  matches_played: number;   // Number of matches played
  
  // Position
  position: number;         // Slot number (1-8)
  is_confirmed: boolean;    // Registration status
  
  // Timestamps
  created_at: string;       // ISO timestamp
  registered_at: string;    // ISO timestamp
  updated_at?: string;      // ISO timestamp (optional)
}
```

**Example Documents:**
```javascript
// players collection
{
  id: "abc123",
  data: {
    uid: "firebase_auth_uid_123",
    name: "John Doe",
    email: "john@example.com",
    gender: "male",
    position: 1,
    points: 4,
    score: 42,
    matches_played: 2,
    is_confirmed: true,
    created_at: "2026-03-24T10:00:00Z",
    registered_at: "2026-03-24T10:00:00Z"
  }
}
```

### Collection: `matches`

Stores all tournament matchups.

**Document Structure:**
```typescript
{
  // Match Info
  id?: string;              // Auto-generated
  round: number;            // Round number (1, 2, 3...)
  match_number: number;     // Match within round
  
  // Players
  player1_id: string;       // Firestore doc ID
  player1_name: string;
  player1_gender: string;
  player1_seed?: number;    // Seeding position
  
  player2_id: string;
  player2_name: string;
  player2_gender: string;
  player2_seed?: number;
  
  // Score
  player1_score?: number;   // Points scored
  player2_score?: number;
  winner_id?: string;       // Firestore doc ID of winner
  status: "pending" | "completed" | "scheduled";
  
  // Next Round Link
  next_match_id?: string;   // ID of match in next round
  next_match_position?: number; // 1=winner, 2=loser
  
  // Metadata
  created_at: string;
  updated_at?: string;
}
```

**Example:**
```javascript
{
  id: "match_001",
  round: 1,
  match_number: 1,
  player1_id: "abc123",
  player1_name: "John Doe",
  player1_gender: "male",
  player1_seed: 1,
  player2_id: "def456",
  player2_name: "Jane Smith",
  player2_gender: "female",
  player2_seed: 8,
  player1_score: 21,
  player2_score: 15,
  winner_id: "abc123",
  status: "completed",
  next_match_id: "match_005",
  next_match_position: 1,
  created_at: "2026-03-24T12:00:00Z"
}
```

### Collection: `scores`

Stores individual score submissions (audit trail).

**Document Structure:**
```typescript
{
  match_id: string;         // Reference to matches collection
  player_id: string;        // Who submitted the score
  player_name: string;
  score_player1: number;
  score_player2: number;
  submitted_at: string;     // ISO timestamp
  verified: boolean;        // Admin verification flag
}
```

### Collection: `tournamentSettings`

Global tournament configuration.

**Document Structure:**
```typescript
{
  tournament_date: string;          // Tournament date (YYYY-MM-DD)
  tournament_city: string;          // Tournament city name (e.g., "Da Nang")
  max_players_per_gender: number;   // Usually 8
  registration_cutoff_days: number; // Days before tournament to close registration
  updated_at: string;               // ISO timestamp of last update
}
```

**Document ID:** `default_settings` (fixed document ID to prevent duplicates)

**Example:**
```javascript
{
  id: "default_settings",
  tournament_date: "2026-04-21",
  tournament_city: "Da Nang",
  max_players_per_gender: 8,
  registration_cutoff_days: 3,
  updated_at: "2026-04-21T21:05:57.497Z"
}
```

**Important Implementation Notes:**
- Uses **fixed document ID** (`default_settings`) instead of auto-generated IDs
- This prevents multiple settings documents from being created
- All saves use `setDoc()` with `{ merge: true }` to update the same document
- Loaded via: `doc(db, 'tournamentSettings', 'default_settings')`

### Collection: `admin_users`

Admin user list (alternative to Firebase custom claims).

**Document Structure:**
```typescript
{
  email: string;
  uid: string;
  role: "admin" | "super_admin";
  added_by: string;
  added_at: string;
}
```

### Data Relationships

```
Firebase Auth
    ↓ (uid)
players (uid field)
    ↓ (email match)
matches (player1_id, player2_id)
    ↓
scores (match_id, player_id)
    
tournament_settings (global config)
admin_users (access control)
```

---

## 5. Core Logic

### Registration Limit Logic

**Constraint:** Maximum 8 players per gender division.

**Implementation:**
```typescript
// src/utils/placeholderUtils.ts
export const getNextAvailablePlaceholder = async (gender: 'male' | 'female') => {
  const playersRef = collection(db, 'players');
  const q = query(playersRef, where('gender', '==', gender));
  const snapshot = await getDocs(q);
  
  // Filter for unconfirmed placeholders
  const placeholderPrefix = gender === 'male' ? 'Male Player' : 'Female Player';
  const availableSlots = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((player: any) => {
      const isPlaceholder = player.name.startsWith(placeholderPrefix);
      const isUnconfirmed = !player.is_confirmed || player.is_confirmed === false;
      return isPlaceholder && isUnconfirmed;
    })
    .sort((a: any, b: any) => a.position - b.position);
  
  // Return first available slot or null if full
  return availableSlots.length > 0 ? availableSlots[0] : null;
};
```

**How It Works:**
1. Query all players of specified gender
2. Filter for placeholder names ("Male Player 1", etc.)
3. Filter for unconfirmed status
4. Sort by position (1-8)
5. Return first available or null (division full)

### Duplicate Prevention

**Prevent same email from registering twice:**

```typescript
// Before creating account
const q = query(
  collection(db, 'players'),
  where('email', '==', email.toLowerCase())
);
const snapshot = await getDocs(q);

if (!snapshot.empty) {
  throw new Error('EMAIL_ALREADY_EXISTS');
}

// Firebase Auth also prevents duplicate emails natively
```

### Access Control

**Only registered players can access tournament pages:**

```typescript
// src/components/ProtectedRoute.tsx
export const validateUserAccess = async () => {
  const user = auth.currentUser;
  
  if (!user) {
    return { isAuthenticated: false, isRegistered: false };
  }
  
  // Query Firestore by email field
  const q = query(
    collection(db, 'players'),
    where('email', '==', user.email.toLowerCase())
  );
  const snapshot = await getDocs(q);
  
  const playerData = snapshot.empty ? null : snapshot.docs[0].data();
  
  return {
    isAuthenticated: true,
    isRegistered: !!playerData?.is_confirmed,
    playerData
  };
};
```

**Usage:**
```typescript
// In ProtectedRoute component
const accessData = await validateUserAccess();

if (!accessData.isAuthenticated) {
  return <Navigate to="/" />; // Not logged in
}

if (!accessData.isRegistered) {
  return <Navigate to="/register" />; // Not registered
}

return <>{children}</>; // Access granted
```

### Ranking Logic

**Point System:**
- **Win**: 2 points
- **Loss**: 1 point
- **No-show/Tie**: 0 points (configurable)

**6-Level Deterministic Tiebreaker System:**
1. Total points (highest first)
2. Total score (highest first)
3. Point differential (scored - conceded, highest first)
4. Head-to-head record (wins, then score difference)
5. Strength of opponents (sum of opponents' points)
6. Final fallback: Player ID (lexicographically smallest)

**Tiebreaker Indicators:**
- Visual labels show which rule decided tied rankings
- Only displayed when tiebreaker was actually used
- Clean, minimal styling that doesn't distract

**Ranking Calculation:**
```typescript
// src/utils/rankingTiebreaker.ts
export const sortPlayersWithTiebreakers = (
  players: Player[],
  matches: Match[]
): Player[] => {
  // Build player points map
  const playerPointsMap = new Map<string, number>();
  players.forEach(p => {
    if (p.id) playerPointsMap.set(p.id, p.points);
  });

  // Sort using complete tiebreaker system
  return [...players].sort((a, b) => 
    comparePlayers(a, b, matches, playerPointsMap)
  );
};
```

**Score Update Logic:**
```typescript
// When submitting match score
export const updateMatchAndRankings = async (
  matchId: string,
  player1Score: number,
  player2Score: number
) => {
  const matchRef = doc(db, 'matches', matchId);
  const batch = writeBatch(db);
  
  // 1. Update match record
  const winner = player1Score > player2Score ? 'player1' : 'player2';
  batch.update(matchRef, {
    player1_score: player1Score,
    player2_score: player2Score,
    winner_id: winner === 'player1' ? player1Id : player2Id,
    status: 'completed'
  });
  
  // 2. Update player stats
  const winnerRef = doc(db, 'players', winnerId);
  const loserRef = doc(db, 'players', loserId);
  
  batch.update(winnerRef, {
    points: increment(2),
    score: increment(player1Score),
    matches_played: increment(1)
  });
  
  batch.update(loserRef, {
    points: increment(1),
    score: increment(player2Score),
    matches_played: increment(1)
  });
  
  await batch.commit();
};
```

---

## 6. Champion Final System

### Overview
After the initial 7 matches per division, the top 2 ranked females and top 2 ranked males qualify for a final mixed doubles match (8th match overall). This determines the tournament champions.

### Final Match Structure
- **Format**: Best of 3 sets
- **Sets 1-2**: Played to 21 points
- **Set 3** (if needed): Played to 15 points
- **Teams**: Mixed doubles (1 male + 1 female per team)

### Team Composition
```
Team 1: Male #1 (highest ranked) + Female #2 (second highest ranked)
Team 2: Female #1 (highest ranked) + Male #2 (second highest ranked)
```

This cross-pairing ensures balanced competition.

### Champion Titles
**Winning Team:**
- Male player → **👑 King of the Beach 👑**
- Female player → **👑 Queen of the Beach 👑**

**Losing Team:**
- Male player → **🤴 Prince of the Beach 🤴**
- Female player → **👸 Princess of the Beach 👸**

### UI Implementation
**Champion Section Features:**
- Golden background for King/Queen cards (`bg-yellow-500/20`)
- Matching crown emojis flanking titles
- **Prince/Princess text in bold** (`font-bold`) for visual balance with King/Queen
- Centered alignment for all text
- Final match completion date display in format: `DD/MM/YYYY · City` (e.g., "21/04/2026 · Da Nang")
- Tournament city loaded from `tournamentSettings` collection
- Clean visual hierarchy between champions and runners-up

**Tournament City Display:**
```tsx
{finalMatchWinner.completedAt && (
  <p className="text-sm font-bold text-white/70 mt-2">
    {new Date(finalMatchWinner.completedAt).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })}
    {tournamentSettings?.tournament_city && ` · ${tournamentSettings.tournament_city}`}
  </p>
)}
```

**Code Location:** `src/pages/Index.tsx` and `src/pages/LiveRanking.tsx`

### Final Match Data Structure
```typescript
type FinalMatchWinner = {
  winningTeam: 1 | 2;
  completedAt?: string;  // ISO timestamp
} | null;
```

---

## 7. Deterministic Tiebreaker System

### Overview
A comprehensive 6-level tiebreaker system ensures unique player rankings with no shared positions. This is critical for determining the top 2 players who qualify for the Champion Final.

### Tiebreaker Hierarchy

**Level 1: Total Points**
- Win: 2 points
- Loss: 1 point
- Higher points = higher rank

**Level 2: Total Score**
- Sum of all points scored across matches
- Higher total score = higher rank

**Level 3: Point Differential**
- Calculation: `points_scored - points_conceded`
- Higher differential = higher rank
- Rewards both offensive and defensive performance

**Level 4: Head-to-Head Record**
- Direct matches between the two tied players
- Primary: Number of wins against each other
- Secondary: Score difference in head-to-head matches
- More wins or better score difference = higher rank

**Level 5: Strength of Opponents**
- Sum of total points of all opponents faced
- Higher strength = higher rank
- Rewards players who faced tougher competition

**Level 6: Final Fallback (Player ID)**
- Lexicographic comparison of player document IDs
- Smallest ID wins
- Guarantees deterministic ordering even in extreme edge cases

### Implementation

**Core Function:**
```typescript
// src/utils/rankingTiebreaker.ts
export const comparePlayers = (
  a: Player,
  b: Player,
  matches: Match[],
  playerPointsMap: Map<string, number>
): number => {
  // 1. Total points
  if (b.points !== a.points) return b.points - a.points;
  
  // 2. Total score
  if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
  
  // 3. Point differential
  const aDiff = calculatePointDifferential(a.id, matches);
  const bDiff = calculatePointDifferential(b.id, matches);
  if (bDiff !== aDiff) return bDiff - aDiff;
  
  // 4. Head-to-head
  const h2h = getHeadToHeadStats(a.id, b.id, matches);
  if (h2h.wins !== 0) return h2h.wins > 0 ? -1 : 1;
  if (h2h.scoreDiff !== 0) return h2h.scoreDiff > 0 ? -1 : 1;
  
  // 5. Strength of opponents
  const aStrength = calculateStrengthOfOpponents(a.id, matches, playerPointsMap);
  const bStrength = calculateStrengthOfOpponents(b.id, matches, playerPointsMap);
  if (bStrength !== aStrength) return bStrength - aStrength;
  
  // 6. Player ID fallback
  return (a.id || '').localeCompare(b.id || '');
};
```

### Tiebreaker Indicators

**Visual Display:**
When players are tied on points, a small label appears below their ranking card showing which tiebreaker rule determined their order:

- `Tiebreaker: Score` - Total score decided
- `Tiebreaker: Difference` - Point differential decided
- `Tiebreaker: Head-to-head` - Head-to-head record decided
- `Tiebreaker: Opponents` - Strength of opponents decided
- `Tiebreaker: Final rule` - Player ID was the final decider

**Styling:**
- Small text (`text-xs`)
- Subtle color (`text-foreground/50` or `text-white/70` for rank #1)
- Centered below player card
- Only shown when tiebreaker was actually used

**Code Location:**
- Detection: `src/utils/rankingTiebreaker.ts` (`getTiebreakerLevel` function)
- Display: `src/pages/Index.tsx` and `src/pages/LiveRanking.tsx`

### Real-Time Tiebreaker Updates

**LiveRanking Page:**
- Fetches match data in real-time via Firestore listener
- Applies full tiebreaker system (same as tournament page)
- Indicators update automatically when scores change

**Implementation:**
```typescript
// src/pages/LiveRanking.tsx
const [matches, setMatches] = useState<Match[]>([]);

// Real-time listener for matches
const matchesRef = collection(db, 'matches');
onSnapshot(matchesRef, (snapshot) => {
  const allMatches = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      player1: { id: data.player1_id, name: data.player1_name, ... },
      // ... other players
      score1: data.score1,
      score2: data.score2,
      isSubmitted: data.is_completed || data.is_submitted
    } as Match;
  });
  setMatches(allMatches);
});
```

### Benefits

1. **Fairness**: Multiple criteria ensure comprehensive evaluation
2. **Deterministic**: Always produces unique rankings, no ties
3. **Transparent**: Players can see exactly why they ranked where they did
4. **Performance**: Optimized for 8 players × 7 matches
5. **Maintainable**: Centralized logic in single utility file

---

## 8. App Flow

### New User Registration Flow

```
1. User visits landing page (/)
   ↓
2. Clicks "Register Now" button
   ↓
3. Navigates to /register page
   ↓
4. Fills registration form:
   - Name
   - Email
   - Password (min 6 chars)
   - Gender division (Male/Female)
   ↓
5. Submits form
   ↓
6. Backend validation:
   - Check email not already registered
   - Check division not full
   - Validate password strength
   ↓
7. Create Firebase Auth account
   ↓
8. Find next available placeholder slot
   ↓
9. Update placeholder document:
   - Replace name: "Male Player 1" → "John Doe"
   - Set email, is_confirmed = true
   - Set position, points, score
   ↓
10. Store in localStorage:
    - tournament_registered_email
    - tournament_registered_name
    ↓
11. Show success toast
    ↓
12. Navigate to /tournament/{gender}
    ↓
13. ProtectedRoute verifies registration
    ↓
14. Display tournament page
```

### Returning User Login Flow

```
1. User visits app (/)
   ↓
2. Clicks "Sign In" button
   ↓
3. Navigates to /sign-in page
   ↓
4. Option A: Google Sign-In
   - Click "Continue with Google"
   - Firebase OAuth popup
   - Authenticate
   - Redirect to tournament page
   
   Option B: Email + Password
   - Enter email
   - Enter password
   - Click "Sign In"
   ↓
5. Verify credentials with Firebase Auth
   ↓
6. Query Firestore "players" by email
   ↓
7. Check is_confirmed = true
   ↓
8. Navigate to /tournament/{gender}
   ↓
9. Display tournament page
```

### Accessing Matchups & Rankings

```
1. User navigates to tournament page
   ↓
2. ProtectedRoute checks:
   - Is authenticated? (yes)
   - Is registered? (yes)
   ↓
3. Load tournament data:
   - Fetch players by gender
   - Fetch matches
   - Calculate rankings
   ↓
4. Display components:
   - MatchCard (bracket view)
   - RankingsTable (leaderboard)
   - Player stats
   ↓
5. Real-time updates via Firestore listeners
```

### Submitting Scores

```
1. Player views completed match
   ↓
2. Clicks "Submit Score" button
   ↓
3. Enters score:
   - Their score
   - Opponent's score
   ↓
4. Validates:
   - User is participant in match
   - Match is not already completed
   - Score values are valid
   ↓
5. Creates score submission record
   ↓
6. Updates match document:
   - Set scores
   - Mark as completed
   - Set winner
   ↓
7. Updates player stats:
   - Add points (win=2, loss=1)
   - Add to total score
   - Increment matches_played
   ↓
8. Rankings auto-recalculate
   ↓
9. UI updates in real-time
```

### Admin Resetting Tournament

```
1. Admin logs in with admin credentials
   ↓
2. Navigates to /admin panel
   ↓
3. Clicks "Reset Tournament" button
   ↓
4. Confirms action (double-check modal)
   ↓
5. Admin enters confirmation phrase
   ↓
6. Execute reset:
   - Delete all players
   - Delete all matches
   - Delete all scores
   - Recreate placeholder players
   ↓
7. Reset confirmation
   ↓
8. All users see fresh tournament
```

**Reset Implementation:**
```typescript
// src/utils/resetUtils.ts
export const resetTournament = async () => {
  const batch = writeBatch(db);
  
  // 1. Delete all existing players
  const playersSnapshot = await getDocs(collection(db, 'players'));
  playersSnapshot.forEach(doc => batch.delete(doc.ref));
  
  // 2. Delete all matches
  const matchesSnapshot = await getDocs(collection(db, 'matches'));
  matchesSnapshot.forEach(doc => batch.delete(doc.ref));
  
  // 3. Delete all scores
  const scoresSnapshot = await getDocs(collection(db, 'scores'));
  scoresSnapshot.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  
  // 4. Recreate placeholders
  await resetPlayersToPlaceholders();
};
```

---

## 7. Functions & Key Code Logic

### registerPlayer()

**Purpose:** Register a new player for the tournament.

**Location:** `src/utils/authUtils.ts`

**When Called:** User submits registration form.

**Logic:**
1. Validate inputs (email, password, name, gender)
2. Check email uniqueness in Firestore
3. Create Firebase Auth account
4. Find next available placeholder slot
5. Update placeholder with player info
6. Return success/error

**Parameters:**
- `email`: string
- `password`: string
- `name`: string
- `gender`: "male" | "female"

**Returns:** Promise<{ success: boolean, user?: any, error?: string }>

---

### loginUser()

**Purpose:** Authenticate user with email and password.

**Location:** `src/utils/authUtils.ts`

**When Called:** User submits login form.

**Logic:**
1. Call Firebase signInWithEmailAndPassword
2. Get user from auth.currentUser
3. Query Firestore for player data
4. Return auth status + registration status

**Parameters:**
- `email`: string
- `password`: string

**Returns:** Promise<{ success: boolean, user?: any, isRegistered?: boolean }>

---

### checkIfRegistered()

**Purpose:** Verify if user is registered for tournament.

**Location:** `src/utils/authUtils.ts`

**When Called:** After login, before accessing protected routes.

**Logic:**
1. Get current user email from Firebase Auth
2. Query Firestore: WHERE email == user.email
3. If document exists and is_confirmed = true → registered
4. Return player data or null

**Parameters:**
- `email`: string

**Returns:** Promise<{ isRegistered: boolean, playerData: any | null }>

---

### submitScore()

**Purpose:** Submit match score and update rankings.

**Location:** `src/utils/matchUtils.ts`

**When Called:** Player submits score for completed match.

**Logic:**
1. Validate user is match participant
2. Validate match is not already completed
3. Determine winner based on scores
4. Update match document with scores
5. Update both player stats:
   - Winner: +2 points, +score
   - Loser: +1 point, +score
6. Create score submission record

**Parameters:**
- `matchId`: string
- `player1Score`: number
- `player2Score`: number
- `submitterId`: string

**Returns:** Promise<{ success: boolean }>

---

### calculateRanking()

**Purpose:** Calculate tournament rankings for a division.

**Location:** `src/utils/rankingUtils.ts`

**When Called:** Loading tournament page, after score updates.

**Logic:**
1. Fetch all confirmed players for gender
2. Sort by:
   - Points (descending)
   - Score (descending, tie-breaker)
   - Name (alphabetically)
3. Assign rank numbers
4. Return ranked list

**Parameters:**
- `gender`: "male" | "female"

**Returns:** Array of player objects with rank property

---

### resetTournament()

**Purpose:** Completely reset tournament data.

**Location:** `src/utils/resetUtils.ts`

**When Called:** Admin initiates tournament reset.

**Logic:**
1. Verify admin permissions
2. Delete all player documents
3. Delete all match documents
4. Delete all score documents
5. Recreate placeholder players (8 male, 8 female)
6. Reset tournament settings

**Parameters:** None

**Returns:** Promise<{ success: boolean }>

---

### registerPlayerToSlot()

**Purpose:** Replace placeholder with real player info.

**Location:** `src/utils/placeholderUtils.ts`

**When Called:** During registration process.

**Logic:**
1. Check email doesn't already exist
2. Find next available placeholder
3. Update document:
   - Replace name
   - Set email
   - Set is_confirmed = true
   - Set registered_at timestamp
4. Return position number

**Parameters:**
- `name`: string
- `email`: string
- `gender`: "male" | "female"

**Returns:** Promise<{ position: number, playerId: string }>

---

## 8. Security & Access Control

### Frontend Protection

**Protected Routes:**
```typescript
// src/components/ProtectedRoute.tsx
export default function ProtectedRoute({ children, adminOnly = false }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isTournamentRegistered, setIsTournamentRegistered] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const accessData = await validateUserAccess();
      setIsAuthenticated(accessData.isAuthenticated);
      setIsTournamentRegistered(accessData.isRegistered);
    };
    checkAuth();
  }, []);
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  if (!isTournamentRegistered) {
    return <Navigate to="/register" replace />;
  }
  
  return <>{children}</>;
}
```

**Page-Level Guards:**
- All tournament pages wrapped in ProtectedRoute
- Admin pages have additional admin-only check
- Registration page redirects if already registered

### Firebase Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Players collection
    match /players/{playerId} {
      // Anyone can read confirmed players
      allow read: if resource.data.is_confirmed == true;
      
      // Only authenticated users can create/update their own record
      allow create: if request.auth != null 
                    && request.resource.data.email == request.auth.token.email;
      
      // Only admin or player themselves can update
      allow update: if request.auth != null 
                    && (request.auth.token.email == resource.data.email
                        || get(/databases/$(database)/documents/admin_users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Matches collection
    match /matches/{matchId} {
      // Anyone can read matches
      allow read: if true;
      
      // Only admins can write matches
      allow write: if request.auth != null 
                   && get(/databases/$(database)/documents/admin_users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Scores collection
    match /scores/{scoreId} {
      // Anyone can read scores
      allow read: if true;
      
      // Only authenticated users can submit scores
      allow create: if request.auth != null;
    }
    
    // Admin users collection
    match /admin_users/{adminId} {
      // Only admins can read/write
      allow read, write: if request.auth != null 
                         && get(/databases/$(database)/documents/admin_users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Client-Side Checks

**Email Verification:**
```typescript
// Prevent duplicate registration
const existingPlayer = await checkTournamentRegistration(email);
if (existingPlayer) {
  throw new Error('Already registered');
}
```

**Gender Division Limits:**
```typescript
// Check if division is full
const availableSlot = await getNextAvailablePlaceholder(gender);
if (!availableSlot) {
  throw new Error('Division is full');
}
```

**Match Participation Validation:**
```typescript
// Only allow participants to submit scores
const match = await getMatch(matchId);
if (match.player1_id !== userId && match.player2_id !== userId) {
  throw new Error('Not authorized to submit score');
}
```

---

## 9. UI Structure

### Page Hierarchy

```
/ (Landing Page)
├── /sign-in (Login/Register)
│   ├── Email/Password form
│   └── Google Sign-In button
├── /register (Tournament Registration)
│   ├── Registration form
│   └── Google Sign-In option
├── /tournament (Main Tournament Page - Index.tsx)
│   ├── Gender selector (Male/Female)
│   ├── Match cards with score submission
│   ├── Rankings with tiebreaker indicators
│   └── Champion Final section (post-tournament)
├── /live-ranking (Live Ranking Page)
│   ├── Female/Male/Final tabs
│   ├── Real-time rankings with tiebreaker indicators
│   └── Champion Final display
├── /info (Tournament Info Page)
│   ├── Beach Volleyball Rules
│   ├── How Rankings Work
│   ├── Tiebreaker Rules explanation
│   └── Final Match & Titles info
└── /admin (Admin Panel)
    ├── Player management
    ├── Match controls
    ├── Database reset
    └── Tournament settings
```

### Landing Page (`/`)

**Purpose:** Welcome screen and entry point.

**Components:**
- Hero section with tournament info
- "Register Now" CTA button
- "Sign In" button
- Tournament details (date, location)
- Feature highlights
- **Animated volleyball**: Spinning ball animation cycling through 3 ball images (ball1.jpg, ball2.jpg, ball3.jpg) with ocean blue glow effect
- Info button linking to /info page

**Ball Animation:**
- Rotates through 3 frames every 300ms
- CSS transitions for smooth animation
- Drop-shadow with ocean blue color matching app theme
- Combined with bounce animation for subtle movement

**State:**
- No authentication required
- Public access

---

### Sign-In Page (`/sign-in`)

**Purpose:** User authentication.

**Components:**
- Email input field
- Password input field
- "Sign In" button
- "Continue with Google" button
- Link to registration page
- Password visibility toggle

**Validation:**
- Email format check
- Password required
- Error messages for invalid credentials

---

### Registration Page (`/register`)

**Purpose:** New player registration.

**Components:**
- Name input field
- Email input field
- Password input field (min 6 chars)
- Gender selection (Radio buttons: Male/Female)
- "Register" button
- "Continue with Google" button
- Available spots counter
- Registration deadline notice

**Validation:**
- All fields required
- Email format check
- Password strength (min length)
- Division availability check

**State:**
- Pre-fill email if already authenticated via Google
- Disable registration if division full

---

### Tournament Page (`/tournament`)

**Purpose:** Main tournament interface.

**Features:**
- Gender selector (Male/Female toggle)
- Match cards with score submission
- Rankings with tiebreaker indicators
- Champion Final section (appears after tournament completion)

**Rankings Section:**
- Sorted by 6-level deterministic tiebreaker system
- Visual indicators show which tiebreaker decided tied rankings
- Color-coded ranking cards (1st: sunset gradient, 2nd: ocean, 3rd: palm)
- Real-time updates via Firestore listeners

**Champion Final Section:**
- Appears when final match is completed
- Displays King/Queen (winners) with golden backgrounds
- Displays Prince/Princess (runners-up)
- Shows final match completion date
- Premium visual design with crown emojis

**State:**
- Protected by ProtectedRoute
- Requires authentication + registration
- Real-time Firestore listeners

---

### Admin Panel (`/admin`)

**Purpose:** Tournament management.

**Sections:**

#### 1. Dashboard
- Tournament overview
- Registration count
- Quick actions

#### 2. Player Management
- List all players
- Edit player info
- Remove players
- Manual registration

#### 3. Match Controls
- Initialize matches
- Edit matchups
- Override scores
- Advance winners

#### 4. Database Reset
- "Reset Tournament" button
- Confirmation modal
- Danger zone warnings

#### 5. Settings
- Tournament date configuration
- **Tournament city field** (e.g., "Da Nang")
- Max players setting
- Registration cutoff days
- Save/Load from `tournamentSettings/default_settings` document

**Access Control:**
- ProtectedRoute with adminOnly=true
- Additional admin check in component
- Admin login required

---

### Live Ranking Page (`/live-ranking`)

**Purpose:** Public-facing real-time rankings display (no authentication required).

**Features:**
- Three tabs: Female, Male, Final
- Real-time updates via Firestore listeners
- Tiebreaker indicators for tied players
- Champion Final display (when completed)
- **Match progress counter**: Shows "Match X/14 finished" with blinking status indicator
- **Tournament city display**: Shows in champion section as "DD/MM/YYYY · City"

**Rankings Tab:**
- Fetches players and matches in real-time
- Applies full 6-level tiebreaker system
- Shows tiebreaker labels when players are tied on points
- Color-coded ranking cards matching tournament page style

**Final Tab:**
- Displays completed final match scores
- Shows King/Queen with golden backgrounds and crown emojis
- Shows Prince/Princess as runners-up
- Displays final match completion date

**Real-Time Data:**
```typescript
// Listens to players collection
const playersRef = collection(db, 'players');
onSnapshot(playersRef, (snapshot) => {
  // Update player rankings
});

// Listens to matches collection  
const matchesRef = collection(db, 'matches');
onSnapshot(matchesRef, (snapshot) => {
  // Update tiebreaker calculations
});

// Listens to finalMatches collection
const finalMatchRef = collection(db, 'finalMatches');
onSnapshot(finalMatchRef, (snapshot) => {
  // Update final match display
});
```

**State:**
- Public access (no authentication required)
- Auto-refreshes when data changes

---

### Info Page (`/info`)

**Purpose:** Tournament rules and information display.

**Sections:**
1. **Beach Volleyball Rules** - Standard rules explanation
2. **How Rankings Work** - Points system (Win=2, Loss=1)
3. **Tiebreaker Rules** - 6-level tiebreaker explanation
4. **Final Match & Titles** - Championship final format and titles

**Design:**
- Full-page layout (not a dialog)
- Match app's beach theme with sand gradient background
- Card-based sections with rounded corners
- Back button to return to landing page
- Clean typography and spacing

**Tiebreaker Rules Text:**
> If players are tied on points, ranking is decided by total score, then point difference, then head-to-head results, then strength of opponents. If still tied, a final rule such as player ID is used to ensure a unique ranking.

**State:**
- Public access (no authentication required)
- Static content

---

## 10. Deployment Setup

### GitHub Repository

**Structure:**
```
sandy-scorekeeper/
├── src/
│   ├── components/
│   ├── pages/
│   ├── utils/
│   ├── config/
│   └── hooks/
├── public/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

**Git Workflow:**
```bash
# Local development
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Merge to main
git checkout main
git merge feature/new-feature
git push origin main
```

---

### Cloudflare Pages Deployment

**Step 1: Connect GitHub Repository**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Pages → Create a project
3. Connect GitHub account
4. Select repository: `sandy-scorekeeper`

**Step 2: Build Settings**

```
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: sandy-scorekeeper
```

**Step 3: Environment Variables**

Add Firebase configuration:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Step 4: Deploy**

Cloudflare Pages automatically:
- Detects commits to main branch
- Runs build command
- Deploys to global CDN
- Provides preview URLs for PRs

**Build Configuration:**

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "npm cache clean --force && vite build",
    "preview": "vite preview"
  }
}
```

**Automatic Deployments:**

```
Push to main → Cloudflare webhook triggered → Build starts → Deploy to production
```

**Preview Deployments:**

```
Pull Request → Cloudflare creates preview URL → Test before merge
```

---

### Firebase Configuration

**Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Authentication (Email/Password, Google)
4. Create Firestore database
5. Copy config to `.env.local`

**Step 2: Firestore Setup**

Run migrations or manually create collections:
- players
- matches
- scores
- tournament_settings
- admin_users

**Step 3: Authentication Providers**

Enable:
- Email/Password
- Google Sign-In

**Step 4: Deploy Security Rules**

```bash
firebase deploy --only firestore:rules
```

---

## 11. Improvements & Future Enhancements

### Notifications

**Email Notifications:**
- Match reminder emails
- Score submission reminders
- Tournament updates
- Welcome email on registration

**Push Notifications:**
- Browser push API
- Mobile app notifications
- SMS alerts (Twilio integration)

**Implementation:**
```typescript
// Send email notification
export const sendMatchReminder = async (playerEmail: string, matchTime: string) => {
  // Use SendGrid, Mailgun, or Firebase Extensions
  await sendEmail({
    to: playerEmail,
    subject: 'Upcoming Match Reminder',
    body: `Your match starts at ${matchTime}`
  });
};
```

---

### Better UI/UX

**Responsive Design:**
- Mobile-first approach
- Tablet optimization
- Desktop enhancements

**Animations:**
- Smooth transitions between tabs
- Loading skeletons
- Success/error animations

**Accessibility:**
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast improvements

**Dark Mode:**
- Theme toggle
- CSS variables for colors
- Persistent theme preference

---

### Stats Tracking

**Advanced Analytics:**
- Player performance metrics
- Win/loss records
- Average scores
- Head-to-head statistics
- Tournament history

**Visualizations:**
- Charts (Chart.js or Recharts)
- Performance graphs
- Trend lines
- Heat maps

**Example Stats:**
```typescript
interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPointsScored: number;
  avgPointsConceded: number;
  bestWin: string;
  currentStreak: number;
}
```

---

### Multi-Tournament Support

**Season Management:**
- Multiple tournaments per year
- Season standings
- Championship playoffs

**Tournament Types:**
- Single elimination
- Double elimination
- Round-robin
- Swiss system

**Organization Features:**
- Tournament director dashboard
- Bulk player import
- Custom brackets
- Export results

**Database Changes:**
```typescript
// Add tournament_id to all collections
players: {
  tournament_id: string;
  // ... other fields
}

matches: {
  tournament_id: string;
  // ... other fields
}
```

---

### Payment Integration

**Stripe Integration:**
- Registration fee collection
- Refund processing
- Payment plans
- Early bird discounts

**Implementation:**
```typescript
// Create payment intent
export const createPaymentIntent = async (amount: number) => {
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'usd' })
  });
  
  const { clientSecret } = await response.json();
  return clientSecret;
};
```

---

### Social Features

**Player Profiles:**
- Profile pictures
- Bio/description
- Achievement badges
- Past tournament history

**Social Sharing:**
- Share match results
- Invite friends
- Social media integration

**Comments/Chat:**
- Match commentary
- Player chat rooms
- Announcements channel

---

### Mobile App

**React Native Version:**
- iOS and Android apps
- Native features (camera, notifications)
- Offline support
- App Store distribution

**Progressive Web App (PWA):**
- Install to home screen
- Offline functionality
- Push notifications
- App-like experience

---

### Admin Enhancements

**Advanced Analytics:**
- Registration trends
- Revenue tracking
- Engagement metrics
- Export reports (CSV, PDF)

**Bulk Operations:**
- Import players from CSV
- Bulk email sending
- Mass match creation
- Template-based setup

**Permissions System:**
- Role-based access control
- Custom admin roles
- Activity logging
- Audit trail

---

## Appendix A: File Structure Reference

```
sandy-scorekeeper/
├── src/
│   ├── components/
│   │   ├── ui/               # Shadcn UI components
│   │   ├── AdminControls.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── MatchCard.tsx
│   │   ├── PlayerRankings.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ...
│   ├── config/
│   │   ├── firebase.ts       # Firebase initialization
│   │   └── payment.ts        # Payment config
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── useTournamentData.ts
│   │   └── useRegistrationCheck.ts
│   ├── pages/
│   │   ├── Index.tsx         # Main tournament page
│   │   ├── Landing.tsx       # Landing page with ball animation
│   │   ├── LiveRanking.tsx   # Real-time public rankings
│   │   ├── InfoPage.tsx      # Tournament info and rules
│   │   ├── Register.tsx      # Registration
│   │   ├── SignIn.tsx        # Login
│   │   └── AdminControl.tsx  # Admin panel
│   ├── utils/
│   │   ├── authUtils.ts      # Authentication functions
│   │   ├── matchUtils.ts     # Match operations
│   │   ├── rankingUtils.ts   # Ranking calculations
│   │   ├── rankingTiebreaker.ts  # 6-level tiebreaker system (NEW)
│   │   ├── placeholderUtils.ts # Placeholder system
│   │   └── resetUtils.ts     # Tournament reset
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point
├── public/
│   ├── ball1.jpg             # Volleyball image 1
│   ├── ball2.jpg             # Volleyball image 2
│   ├── ball3.jpg             # Volleyball image 3
│   └── assets/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Appendix B: Environment Variables

**.env.local Example:**
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyB...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Optional: Stripe
VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Optional: Other services
VITE_API_URL=https://api.example.com
```

---

## Appendix C: Common Troubleshooting

### Issue: Registration fails with "unexpected error"

**Solution:**
- Check Firebase console for errors
- Verify Firestore rules allow writes
- Ensure placeholder slots exist
- Check browser console for detailed error

### Issue: User can't access tournament page after registration

**Solution:**
- Verify Firestore document was created
- Check email field matches exactly
- Clear browser cache
- Check ProtectedRoute logic

### Issue: Build fails on Cloudflare Pages

**Solution:**
- Clean npm cache: `npm cache clean --force`
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs for specific error

---

## Conclusion

This documentation provides a complete blueprint for the King & Queen of the Beach tournament tracker. Use it as a reference for:

- Understanding the current implementation
- Onboarding new developers
- Planning future enhancements
- Rebuilding similar applications
- Troubleshooting issues

The modular architecture allows for easy customization and extension. Each component (authentication, database, UI, deployment) is designed to be reusable across different projects.

**Happy Building! 🏐**

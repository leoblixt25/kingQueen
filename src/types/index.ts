export type Gender = "male" | "female";

export type Player = {
  id?: string; // Firestore document ID
  name: string;
  points: number;
  totalScores: number;
};

// Raw match from Firestore - uses player ID arrays
// STRICT: Every match MUST have exactly 4 valid player IDs
export type Match = {
  id?: string;
  gender?: 'male' | 'female';
  match_number: number;
  teamA: [string, string]; // [playerId1, playerId2] - MUST be valid IDs
  teamB: [string, string]; // [playerId3, playerId4] - MUST be valid IDs
  score1: number;
  score2: number;
  isSubmitted: boolean;
  is_completed?: boolean;
};

// Resolved match with full player objects
// STRICT: Every match MUST have exactly 4 valid Player objects
export type ResolvedMatch = {
  id?: string;
  gender?: 'male' | 'female';
  match_number: number;
  teamA: [Player, Player]; // MUST be valid Player objects
  teamB: [Player, Player]; // MUST be valid Player objects
  score1: number;
  score2: number;
  isSubmitted: boolean;
};

export type FinalMatchScores = {
  team1: [number | null, number | null, number | null];
  team2: [number | null, number | null, number | null];
};

export type FinalMatchWinner = {
  winningTeam: 1 | 2;
  completedAt?: string;
} | null;
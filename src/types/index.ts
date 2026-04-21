export type Gender = "male" | "female";

export type Player = {
  id?: string; // Firestore document ID
  name: string;
  points: number;
  totalScores: number;
};

export type Match = {
  id?: string; // Optional for backwards compatibility
  gender?: 'male' | 'female';
  player1: Player;
  player2: Player;
  player3: Player;
  player4: Player;
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

export type Gender = "male" | "female";

export type Player = {
  name: string;
  points: number;
  totalScores: number;
};

export type Match = {
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
  team: 'team1' | 'team2';
  malePlayer: string;
  femalePlayer: string;
  losingMalePlayer: string;
  losingFemalePlayer: string;
} | null;

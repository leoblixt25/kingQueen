export type Gender = 'male' | 'female';

export type Player = {
  id: string;
  name: string;
  gender: Gender;
  points: number;
  total_scores: number;
  created_at?: string;
  updated_at?: string;
};

export type Match = {
  id: string;
  gender: Gender;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  score1: number | null;
  score2: number | null;
  is_submitted: boolean;
  match_order: number;
  created_at?: string;
  updated_at?: string;
};

export type FinalMatch = {
  id: string;
  team1_set1: number | null;
  team1_set2: number | null;
  team1_set3: number | null;
  team2_set1: number | null;
  team2_set2: number | null;
  team2_set3: number | null;
  is_submitted: boolean;
  winner_team: 'team1' | 'team2' | null;
  male_winner: string | null;
  female_winner: string | null;
  male_runner_up: string | null;
  female_runner_up: string | null;
  created_at?: string;
  updated_at?: string;
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

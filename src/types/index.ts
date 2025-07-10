export interface Player {
  id: string;
  name: string;
  gender: 'male' | 'female';
  position: number;
  points: number;
  total_scores: number;
  matches_played: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  gender: 'male' | 'female';
  match_number: number;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  score1: number;
  score2: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Populated fields
  player1?: Player;
  player2?: Player;
  player3?: Player;
  player4?: Player;
}

export interface FinalMatch {
  id: string;
  male_king_id: string | null;
  female_queen_id: string | null;
  male_prince_id: string | null;
  female_princess_id: string | null;
  team1_score: number;
  team2_score: number;
  is_completed: boolean;
  winner_team: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Populated fields
  male_king?: Player;
  female_queen?: Player;
  male_prince?: Player;
  female_princess?: Player;
}

export interface TournamentConfig {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

export interface RankingEntry {
  rank: number;
  player: Player;
  points: number;
  total_scores: number;
  matches_played: number;
}

export interface TournamentState {
  players: {
    male: Player[];
    female: Player[];
  };
  matches: {
    male: Match[];
    female: Match[];
  };
  rankings: {
    male: RankingEntry[];
    female: RankingEntry[];
  };
  finalMatch: FinalMatch | null;
  currentPhase: string;
  isLoading: boolean;
  error: string | null;
}

export interface ScoreUpdate {
  matchId: string;
  score1: number;
  score2: number;
}

export type Gender = 'male' | 'female';
export type TournamentPhase = 'setup' | 'active' | 'final' | 'completed';
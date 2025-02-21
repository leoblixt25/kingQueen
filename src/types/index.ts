
export type Gender = "male" | "female";

export interface Player {
  name: string;
  points: number;
  totalScore: number;
}

export interface Match {
  id: number;
  teamA: [string, string];
  teamB: [string, string];
  scoreA?: number;
  scoreB?: number;
  submitted?: boolean;
}

export interface MatchData {
  female: Match[];
  male: Match[];
}

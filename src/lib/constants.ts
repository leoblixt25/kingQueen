// Fixed player names and UUIDs for consistent tournament structure
export const FIXED_PLAYERS = {
  male: [
    { name: "Roma", uuid: "11111111-1111-1111-1111-111111111111", position: 0 },
    { name: "Igor", uuid: "11111111-1111-1111-1111-111111111112", position: 1 },
    { name: "Lorenz", uuid: "11111111-1111-1111-1111-111111111113", position: 2 },
    { name: "Leo", uuid: "11111111-1111-1111-1111-111111111114", position: 3 },
    { name: "Sergey", uuid: "11111111-1111-1111-1111-111111111115", position: 4 },
    { name: "Kevin", uuid: "11111111-1111-1111-1111-111111111116", position: 5 },
    { name: "Yura", uuid: "11111111-1111-1111-1111-111111111117", position: 6 },
    { name: "Artisom", uuid: "11111111-1111-1111-1111-111111111118", position: 7 },
  ],
  female: [
    { name: "Ylan", uuid: "22222222-2222-2222-2222-222222222221", position: 0 },
    { name: "Alexandra", uuid: "22222222-2222-2222-2222-222222222222", position: 1 },
    { name: "Svetlana", uuid: "22222222-2222-2222-2222-222222222223", position: 2 },
    { name: "Diana", uuid: "22222222-2222-2222-2222-222222222224", position: 3 },
    { name: "Julia", uuid: "22222222-2222-2222-2222-222222222225", position: 4 },
    { name: "Gosia", uuid: "22222222-2222-2222-2222-222222222226", position: 5 },
    { name: "Dina", uuid: "22222222-2222-2222-2222-222222222227", position: 6 },
    { name: "Hiro", uuid: "22222222-2222-2222-2222-222222222228", position: 7 },
  ],
} as const;

// Fixed match combinations (14 matches each for male/female)
export const MATCH_COMBINATIONS = [
  [0, 1, 2, 3], [4, 5, 6, 7], [5, 6, 7, 0], [3, 4, 1, 2],
  [6, 3, 4, 1], [0, 2, 7, 5], [2, 4, 3, 7], [1, 6, 5, 0],
  [5, 3, 6, 2], [7, 1, 0, 4], [2, 7, 1, 5], [3, 0, 4, 6],
  [7, 4, 0, 6], [5, 2, 6, 1]
] as const;

// Scoring constants
export const SCORING = {
  WINNER_POINTS: 2,
  LOSER_POINTS: 1,
} as const;

// Tournament phases
export const TOURNAMENT_PHASES = {
  SETUP: 'setup',
  ACTIVE: 'active', 
  FINAL: 'final',
  COMPLETED: 'completed',
} as const;

export type TournamentPhase = typeof TOURNAMENT_PHASES[keyof typeof TOURNAMENT_PHASES];
export type Gender = 'male' | 'female';
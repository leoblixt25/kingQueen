// Static matchup template for both male and female divisions
// This ensures consistent match structure without regeneration

export const STATIC_MATCHUPS = [
  [0, 1, 2, 3], // Match 1
  [4, 5, 6, 7], // Match 2
  [5, 6, 7, 0], // Match 3
  [3, 4, 1, 2], // Match 4
  [6, 3, 4, 1], // Match 5
  [0, 2, 7, 5], // Match 6
  [2, 4, 3, 7], // Match 7
  [1, 6, 5, 0], // Match 8
  [5, 3, 6, 2], // Match 9
  [7, 1, 0, 4], // Match 10
  [2, 7, 1, 5], // Match 11
  [3, 0, 4, 6], // Match 12
  [7, 4, 0, 6], // Match 13
  [5, 2, 6, 1]  // Match 14
];

// Female player names in order
export const FEMALE_PLAYERS = [
  "Ylan",        // 0
  "Alexandra",   // 1
  "Diana",       // 2
  "Svetlana",    // 3
  "Dina",        // 4
  "Julia",       // 5
  "Gosia",       // 6
  "Hiro"         // 7
];

// Male player names in order
export const MALE_PLAYERS = [
  "Sergey",      // 0
  "Kevin",       // 1
  "Yura",        // 2
  "Artisom",     // 3
  "Roma",        // 4
  "Igor",        // 5
  "Lorenz",      // 6
  "Leo"          // 7
];
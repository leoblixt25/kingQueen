// Static matchup template for both male and female divisions
// This ensures consistent match structure without regeneration

export const STATIC_MATCHUPS = [
  [0, 1, 2, 3], // Match 1: Ylan & Alexandra vs Diana & Svetlana / Sergey & Kevin vs Yura & Artisom
  [4, 5, 6, 7], // Match 2: Dina & Julia vs Gosia & Hiro / Roma & Igor vs Lorenz & Leo
  [5, 6, 7, 0], // Match 3: Julia & Gosia vs Hiro & Ylan / Igor & Lorenz vs Leo & Sergey
  [3, 4, 1, 2], // Match 4: Svetlana & Dina vs Alexandra & Diana / Artisom & Roma vs Kevin & Yura
  [6, 3, 4, 1], // Match 5: Gosia & Svetlana vs Dina & Alexandra / Lorenz & Artisom vs Roma & Kevin
  [0, 2, 7, 5], // Match 6: Ylan & Diana vs Hiro & Julia / Sergey & Yura vs Leo & Igor
  [2, 4, 3, 7], // Match 7: Diana & Dina vs Svetlana & Hiro / Yura & Roma vs Artisom & Leo
  [1, 6, 5, 0], // Match 8: Alexandra & Gosia vs Julia & Ylan / Kevin & Lorenz vs Igor & Sergey
  [5, 3, 6, 2], // Match 9: Julia & Svetlana vs Gosia & Diana / Igor & Artisom vs Lorenz & Yura
  [7, 1, 0, 4], // Match 10: Hiro & Alexandra vs Ylan & Dina / Leo & Kevin vs Sergey & Roma
  [2, 7, 1, 5], // Match 11: Diana & Hiro vs Alexandra & Julia / Yura & Leo vs Kevin & Igor
  [3, 0, 6, 4], // Match 12: Svetlana & Ylan vs Gosia & Dina / Artisom & Sergey vs Lorenz & Roma
  [7, 4, 0, 6], // Match 13: Hiro & Dina vs Ylan & Gosia / Leo & Roma vs Sergey & Lorenz
  [5, 2, 3, 1]  // Match 14: Julia & Diana vs Svetlana & Alexandra / Igor & Yura vs Artisom & Kevin
];

// Female player names in order - placeholders
export const FEMALE_PLAYERS = [
  "Female Player 1",  // 0
  "Female Player 2",  // 1
  "Female Player 3",  // 2
  "Female Player 4",  // 3
  "Female Player 5",  // 4
  "Female Player 6",  // 5
  "Female Player 7",  // 6
  "Female Player 8"   // 7
];

// Male player names in order - placeholders
export const MALE_PLAYERS = [
  "Male Player 1",    // 0
  "Male Player 2",    // 1
  "Male Player 3",    // 2
  "Male Player 4",    // 3
  "Male Player 5",    // 4
  "Male Player 6",    // 5
  "Male Player 7",    // 6
  "Male Player 8"     // 7
];
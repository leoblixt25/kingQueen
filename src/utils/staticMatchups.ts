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

import { Match, Player, Gender } from "@/types";

export function useCreateMatches() {
  const createInitialMatches = (currentGender: Gender, playersList: Player[]) => {
    if (playersList.length < 4) return [];
    
    const initialMatches: Match[] = [];
    const numMatches = 14;
    
    for (let i = 0; i < numMatches; i++) {
      const idx1 = i % playersList.length;
      const idx2 = (i + 1) % playersList.length;
      const idx3 = (i + 2) % playersList.length;
      const idx4 = (i + 3) % playersList.length;
      
      const match: Match = {
        player1: playersList[idx1],
        player2: playersList[idx2],
        player3: playersList[idx3],
        player4: playersList[idx4],
        score1: 0,
        score2: 0,
        isSubmitted: false
      };
      
      initialMatches.push(match);
    }
    
    return initialMatches;
  };

  return { createInitialMatches };
}

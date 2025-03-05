
import { Match } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { findMatchInDatabase, updateMatchInDatabase } from "@/utils/matchDatabaseUtils";

interface UseScoreEditingProps {
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  updatePlayerPoints: (match: Match, scoreValues?: { score1: string, score2: string }) => Promise<void>;
}

export function useScoreEditing({
  matches,
  setMatches,
  updatePlayerPoints
}: UseScoreEditingProps) {
  const { toast } = useToast();

  const handleEditScore = async (matchIndex: number, newScore1: number, newScore2: number) => {
    console.log("handleEditScore called with:", { matchIndex, newScore1, newScore2 });
    
    if (!matches || !matches[matchIndex]) {
      console.error("Match not found for editing");
      toast({
        title: "Error",
        description: "Match not found",
        variant: "destructive",
      });
      return;
    }
    
    const oldMatch = matches[matchIndex];
    console.log("Editing match:", { 
      players: `${oldMatch.player1.name} & ${oldMatch.player2.name} vs ${oldMatch.player3.name} & ${oldMatch.player4.name}`,
      oldScores: `${oldMatch.score1} - ${oldMatch.score2}`,
      newScores: `${newScore1} - ${newScore2}`
    });
    
    // Create a deep copy of the matches array
    const newMatches = JSON.parse(JSON.stringify(matches));
    
    // Update the specific match with edited scores
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    };

    try {
      // Find the match in the database
      const existingMatches = await findMatchInDatabase(oldMatch);
      
      if (existingMatches && existingMatches.length > 0) {
        console.log("Found match in database, updating score");
        // Update existing match
        await updateMatchInDatabase(existingMatches[0].id, newScore1, newScore2);
        console.log("Match updated in database");
      } else {
        console.log("Match not found in database, skipping update");
      }
    
      const scoreValues = {
        score1: newScore1.toString(),
        score2: newScore2.toString()
      };
      
      await updatePlayerPoints(newMatches[matchIndex], scoreValues);
      console.log("Player points updated after edit");
      
      // Update the state with the new matches array
      console.log("Setting matches state with edited matches");
      setMatches(newMatches);
      
      toast({
        title: "Score updated",
        description: `Match ${matchIndex + 1} score updated: ${newScore1} - ${newScore2}`,
      });
    } catch (error) {
      console.error("Exception during database operations:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return { handleEditScore };
}

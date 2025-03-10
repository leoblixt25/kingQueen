
import { Match, Player } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { saveMatchToDatabase } from "@/utils/matchDatabaseUtils";

interface UseScoreSubmissionProps {
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (index: number) => void;
  score1: string;
  score2: string;
  updatePlayerPoints: (match: Match, scoreValues?: { score1: string, score2: string }) => Promise<void>;
  players: Player[];
}

export function useScoreSubmission({
  matches,
  setMatches,
  currentMatchIndex,
  setCurrentMatchIndex,
  score1,
  score2,
  updatePlayerPoints,
  players
}: UseScoreSubmissionProps) {
  const { toast } = useToast();

  const handleScoreSubmit = async () => {
    console.log("handleScoreSubmit called with:", { 
      currentMatchIndex, 
      score1, 
      score2, 
      matchesLength: matches?.length 
    });
    
    if (!matches || !matches[currentMatchIndex]) {
      console.error("No match available to submit scores for");
      toast({
        title: "Error",
        description: "No match available to submit scores for",
        variant: "destructive",
      });
      return;
    }

    const currentMatch = matches[currentMatchIndex];
    const parseScore1 = parseInt(score1, 10) || 0;
    const parseScore2 = parseInt(score2, 10) || 0;
    
    console.log("Submitting scores:", { 
      matchIndex: currentMatchIndex, 
      score1: parseScore1, 
      score2: parseScore2,
      players: `${currentMatch.player1.name} & ${currentMatch.player2.name} vs ${currentMatch.player3.name} & ${currentMatch.player4.name}`
    });

    try {
      // Save match to database
      await saveMatchToDatabase(currentMatch, parseScore1, parseScore2);
      
      // Create a deep copy of the matches array
      const newMatches = JSON.parse(JSON.stringify(matches));
      
      console.log("Original matches before update:", newMatches.length);
      
      // Update the specific match with new scores
      newMatches[currentMatchIndex] = {
        ...newMatches[currentMatchIndex],
        score1: parseScore1,
        score2: parseScore2,
        isSubmitted: true,
      };
      
      console.log("Updated match in newMatches:", newMatches[currentMatchIndex]);
      
      // Update player points with current scores
      const scoreValuesForUpdate = {
        score1: parseScore1.toString(),
        score2: parseScore2.toString()
      };
      
      await updatePlayerPoints(newMatches[currentMatchIndex], scoreValuesForUpdate);
      console.log("Player points updated successfully");
      
      // Create next match if we're at the end and there are enough players
      if (currentMatchIndex === newMatches.length - 1 && players.length >= 4) {
        console.log("Creating next match as we're at the end");
        const nextMatch: Match = {
          player1: players[0],
          player2: players[1],
          player3: players[2],
          player4: players[3],
          score1: 0,
          score2: 0,
          isSubmitted: false
        };
        newMatches.push(nextMatch);
        console.log("New match added, new total:", newMatches.length);
      }
      
      // Update the state with the new matches array
      console.log("Setting matches state with updated matches:", newMatches.length);
      setMatches(newMatches);
      
      toast({
        title: "Score submitted",
        description: `Match ${currentMatchIndex + 1} score recorded: ${parseScore1} - ${parseScore2}`,
      });
      
      // Only move to the next match if there is one available
      if (currentMatchIndex < newMatches.length - 1) {
        // Use a short timeout to ensure state updates have time to propagate
        setTimeout(() => {
          console.log("Moving to next match:", currentMatchIndex + 1);
          setCurrentMatchIndex(currentMatchIndex + 1);
        }, 300);
      } else {
        console.log("Already at last match, staying at current index:", currentMatchIndex);
      }
    } catch (error) {
      console.error("Exception during match submission:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving the match",
        variant: "destructive",
      });
    }
  };

  return { handleScoreSubmit };
}

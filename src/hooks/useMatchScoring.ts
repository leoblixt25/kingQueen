import { Match, Player } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseMatchScoringProps {
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (index: number) => void;
  score1: string;
  score2: string;
  setScore1: (score: string) => void;
  setScore2: (score: string) => void;
  updatePlayerPoints: (match: Match, scoreValues?: { score1: string, score2: string }) => Promise<void>;
  players: Player[];
}

export function useMatchScoring({
  matches,
  setMatches,
  currentMatchIndex,
  setCurrentMatchIndex,
  score1,
  score2,
  setScore1,
  setScore2,
  updatePlayerPoints,
  players
}: UseMatchScoringProps) {
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

    // Create data to insert into Supabase
    const scoreData = {
      player1_id: currentMatch.player1.id,
      player2_id: currentMatch.player2.id,
      player3_id: currentMatch.player3.id,
      player4_id: currentMatch.player4.id,
      score1: parseScore1,
      score2: parseScore2,
      is_submitted: true
    };

    try {
      // Insert into Supabase
      const { error } = await supabase
        .from('matches')
        .insert(scoreData);

      if (error) {
        console.error("Error saving match to Supabase:", error);
        toast({
          title: "Error saving match",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      console.log("Match saved to Supabase successfully");

      // Important: Create a deep copy of the matches array to avoid state mutations
      const newMatches = [...matches.map(m => ({...m}))];
      
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
        }, 500);
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
    
    // Create a deep copy of the matches array using JSON methods for true deep cloning
    const newMatches = JSON.parse(JSON.stringify(matches));
    
    // Update the specific match with edited scores
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    };

    // Find the match in the database
    try {
      const { data: existingMatches, error: findError } = await supabase
        .from('matches')
        .select('*')
        .eq('player1_id', oldMatch.player1.id)
        .eq('player2_id', oldMatch.player2.id)
        .eq('player3_id', oldMatch.player3.id)
        .eq('player4_id', oldMatch.player4.id);
      
      if (findError) {
        console.error("Error finding match:", findError);
        toast({
          title: "Error finding match",
          description: findError.message,
          variant: "destructive",
        });
        return;
      }
      
      if (existingMatches && existingMatches.length > 0) {
        console.log("Found match in database, updating score");
        // Update existing match
        const { error: updateError } = await supabase
          .from('matches')
          .update({ 
            score1: newScore1, 
            score2: newScore2 
          })
          .eq('id', existingMatches[0].id);
        
        if (updateError) {
          console.error("Error updating match:", updateError);
          toast({
            title: "Error updating match",
            description: updateError.message,
            variant: "destructive",
          });
          return;
        }
        
        console.log("Match updated in database");
      } else {
        console.log("Match not found in database, skipping update");
      }
    } catch (error) {
      console.error("Exception during database operations:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return;
    }

    const scoreValues = {
      score1: newScore1.toString(),
      score2: newScore2.toString()
    };
    
    try {
      await updatePlayerPoints(newMatches[matchIndex], scoreValues);
      console.log("Player points updated after edit");
    } catch (error) {
      console.error("Error updating player points during edit:", error);
    }
    
    // Update the state with the new matches array
    console.log("Setting matches state with edited matches");
    setMatches(newMatches);
    
    toast({
      title: "Score updated",
      description: `Match ${matchIndex + 1} score updated: ${newScore1} - ${newScore2}`,
    });
  };

  return {
    handleScoreSubmit,
    handleEditScore
  };
}

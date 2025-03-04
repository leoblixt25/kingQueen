
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
    if (!matches || !matches[currentMatchIndex]) {
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

    // Insert into Supabase
    const { error } = await supabase
      .from('matches')
      .insert(scoreData);

    if (error) {
      toast({
        title: "Error saving match",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    // Create a deep copy of the matches array to avoid state mutations
    const newMatches = JSON.parse(JSON.stringify(matches));
    
    // Update the specific match with new scores
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseScore1,
      score2: parseScore2,
      isSubmitted: true,
    };
    
    // Update player points with current scores
    const scoreValuesForUpdate = {
      score1: parseScore1.toString(),
      score2: parseScore2.toString()
    };
    
    await updatePlayerPoints(newMatches[currentMatchIndex], scoreValuesForUpdate);
    
    // Create next match if we're at the end and there are enough players
    if (currentMatchIndex === newMatches.length - 1 && players.length >= 4) {
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
    }
    
    // Update the state with the new matches array first
    setMatches(newMatches);
    
    toast({
      title: "Score submitted",
      description: `Match ${currentMatchIndex + 1} score recorded: ${parseScore1} - ${parseScore2}`,
    });
    
    // IMPORTANT: Set timeout to ensure state update has completed before navigation
    setTimeout(() => {
      // Navigate to the next match if not the last match
      if (currentMatchIndex < newMatches.length - 1) {
        setCurrentMatchIndex(currentMatchIndex + 1);
      }
    }, 50);
  };

  const handleEditScore = async (matchIndex: number, newScore1: number, newScore2: number) => {
    if (!matches || !matches[matchIndex]) {
      toast({
        title: "Error",
        description: "Match not found",
        variant: "destructive",
      });
      return;
    }
    
    const oldMatch = matches[matchIndex];
    
    // Create a deep copy of the matches array
    const newMatches = JSON.parse(JSON.stringify(matches));
    
    // Update the specific match with edited scores
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    };

    // Find the match in the database
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
    }

    const scoreValues = {
      score1: newScore1.toString(),
      score2: newScore2.toString()
    };
    
    await updatePlayerPoints(newMatches[matchIndex], scoreValues);
    
    // Update the state with the new matches array
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

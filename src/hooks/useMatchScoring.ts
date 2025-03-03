
import { Match } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseMatchScoringProps {
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  currentMatchIndex: number;
  score1: string;
  score2: string;
  setScore1: (score: string) => void;
  setScore2: (score: string) => void;
  updatePlayerPoints: (match: Match, scoreValues?: { score1: string, score2: string }) => Promise<void>;
  players: any[];
}

export function useMatchScoring({
  matches,
  setMatches,
  currentMatchIndex,
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

    const scoreData = {
      player1_id: currentMatch.player1.id,
      player2_id: currentMatch.player2.id,
      player3_id: currentMatch.player3.id,
      player4_id: currentMatch.player4.id,
      score1: parseScore1,
      score2: parseScore2,
      is_submitted: true
    };

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
    
    const newMatches = [...matches];
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseScore1,
      score2: parseScore2,
      isSubmitted: true,
    };
    setMatches(newMatches);
    
    // Update player points with current scores
    const scoreValuesForUpdate = {
      score1: parseScore1.toString(),
      score2: parseScore2.toString()
    };
    await updatePlayerPoints(newMatches[currentMatchIndex], scoreValuesForUpdate);
    
    toast({
      title: "Score submitted",
      description: `Match ${currentMatchIndex + 1} score recorded: ${parseScore1} - ${parseScore2}`,
    });
    
    // Create next match if we're at the end and there are enough players
    if (currentMatchIndex === matches.length - 1 && players.length >= 4) {
      const nextMatch: Match = {
        player1: players[0],
        player2: players[1],
        player3: players[2],
        player4: players[3],
        score1: 0,
        score2: 0,
        isSubmitted: false
      };
      setMatches([...newMatches, nextMatch]);
    }
  };

  const handleEditScore = (matchIndex: number, newScore1: number, newScore2: number) => {
    const newMatches = [...matches]
    const oldMatch = newMatches[matchIndex]
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    }

    const oldPlayers = [...players]
    const oldPlayer1Index = oldPlayers.findIndex(p => p.name === oldMatch.player1.name)
    const oldPlayer2Index = oldPlayers.findIndex(p => p.name === oldMatch.player2.name)
    const oldPlayer3Index = oldPlayers.findIndex(p => p.name === oldMatch.player3.name)
    const oldPlayer4Index = oldPlayers.findIndex(p => p.name === oldMatch.player4.name)

    oldPlayers[oldPlayer1Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer2Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer3Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2
    oldPlayers[oldPlayer4Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2

    oldPlayers[oldPlayer1Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer2Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer3Index].totalScores -= oldMatch.score2
    oldPlayers[oldPlayer4Index].totalScores -= oldMatch.score2

    const scoreValues = {
      score1: newScore1.toString(),
      score2: newScore2.toString()
    };
    
    updatePlayerPoints(newMatches[matchIndex], scoreValues);

    setMatches(newMatches);
  };

  return {
    handleScoreSubmit,
    handleEditScore
  };
}

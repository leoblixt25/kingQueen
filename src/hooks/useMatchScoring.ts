
import { Match, Player } from "@/types";
import { useScoreSubmission } from "./useScoreSubmission";
import { useScoreEditing } from "./useScoreEditing";

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

export function useMatchScoring(props: UseMatchScoringProps) {
  const { handleScoreSubmit } = useScoreSubmission(props);
  const { handleEditScore } = useScoreEditing({
    matches: props.matches,
    setMatches: props.setMatches,
    updatePlayerPoints: props.updatePlayerPoints
  });

  return {
    handleScoreSubmit,
    handleEditScore
  };
}

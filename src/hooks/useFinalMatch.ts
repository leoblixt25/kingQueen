
import { useState } from "react";
import { FinalMatchScores, FinalMatchWinner, Player } from "@/types";

export function useFinalMatch() {
  const [showFinalMatch, setShowFinalMatch] = useState(false);
  const [finalMatchScores, setFinalMatchScores] = useState<FinalMatchScores>({
    team1: [null, null, null],
    team2: [null, null, null],
  });
  const [finalMatchSubmitted, setFinalMatchSubmitted] = useState(false);
  const [isEditingFinalMatch, setIsEditingFinalMatch] = useState(false);
  const [finalMatchWinner, setFinalMatchWinner] = useState<FinalMatchWinner>(null);

  const handleFinalMatchSubmit = (malePlayers: Player[], femalePlayers: Player[]) => {
    const team1Scores = finalMatchScores.team1.filter(score => score !== null) as number[]
    const team2Scores = finalMatchScores.team2.filter(score => score !== null) as number[]

    const team1Wins = team1Scores.filter((score, index) => score > (team2Scores[index] || 0)).length
    const team2Wins = team2Scores.filter((score, index) => score > (team1Scores[index] || 0)).length

    if (team1Wins > team2Wins) {
      setFinalMatchWinner({
        team: 'team1',
        malePlayer: malePlayers[0].name,
        femalePlayer: femalePlayers[1].name,
        losingMalePlayer: malePlayers[1].name,
        losingFemalePlayer: femalePlayers[0].name,
      });
    } else if (team2Wins > team1Wins) {
      setFinalMatchWinner({
        team: 'team2',
        malePlayer: malePlayers[1].name,
        femalePlayer: femalePlayers[0].name,
        losingMalePlayer: malePlayers[0].name,
        losingFemalePlayer: femalePlayers[1].name,
      });
    } else {
      setFinalMatchWinner(null);
    }

    setFinalMatchSubmitted(true);
  };

  const handleEditFinalMatch = () => {
    setIsEditingFinalMatch(true);
  };

  const handleFinalMatchEditSubmit = () => {
    setIsEditingFinalMatch(false);
  };

  const handleResetFinalMatch = () => {
    setFinalMatchScores({ team1: [null, null, null], team2: [null, null, null] });
    setFinalMatchSubmitted(false);
    setFinalMatchWinner(null);
  };

  return {
    showFinalMatch,
    setShowFinalMatch,
    finalMatchScores,
    setFinalMatchScores,
    finalMatchSubmitted,
    isEditingFinalMatch,
    finalMatchWinner,
    handleFinalMatchSubmit,
    handleEditFinalMatch,
    handleFinalMatchEditSubmit,
    handleResetFinalMatch
  };
}

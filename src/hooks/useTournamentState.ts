import { useState } from 'react';
import { Player, Match, FinalMatchScores, FinalMatchWinner } from '@/types';

export const useTournamentState = () => {
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>([]);
  const [maleMatches, setMaleMatches] = useState<Match[]>([]);
  const [finalMatchScores, setFinalMatchScores] = useState<FinalMatchScores>({
    team1: [null, null, null],
    team2: [null, null, null],
  });
  const [finalMatchSubmitted, setFinalMatchSubmitted] = useState(false);
  const [finalMatchWinner, setFinalMatchWinner] = useState<FinalMatchWinner>(null);
  const [isLoading, setIsLoading] = useState(true);

  return {
    // State
    femalePlayers,
    malePlayers,
    femaleMatches,
    maleMatches,
    finalMatchScores,
    finalMatchSubmitted,
    finalMatchWinner,
    isLoading,
    // Setters
    setFemalePlayers,
    setMalePlayers,
    setFemaleMatches,
    setMaleMatches,
    setFinalMatchScores,
    setFinalMatchSubmitted,
    setFinalMatchWinner,
    setIsLoading,
  };
};
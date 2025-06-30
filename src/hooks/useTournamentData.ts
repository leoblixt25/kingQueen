
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, Match, FinalMatchScores, FinalMatchWinner } from '@/types';
import { loadPlayers, loadMatches, loadFinalMatch, resetAllData } from '@/utils/supabaseUtils';
import { initializeDefaultPlayers } from '@/utils/playerUtils';
import { initializeMatches, updateMatchScore as updateMatchScoreUtil } from '@/utils/matchUtils';
import { updatePlayerPointsFromMatch } from '@/utils/playerUtils';
import { updateFinalMatch as updateFinalMatchUtil } from '@/utils/finalMatchUtils';

export const useTournamentData = () => {
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

  // Load initial data
  useEffect(() => {
    loadTournamentData();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        loadPlayersData();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatchesData();
      })
      .subscribe();

    const finalMatchChannel = supabase
      .channel('final-match-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, () => {
        loadFinalMatchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalMatchChannel);
    };
  }, []);

  const loadTournamentData = async () => {
    setIsLoading(true);
    console.log('Loading tournament data...');
    
    try {
      await Promise.all([loadPlayersData(), loadMatchesData(), loadFinalMatchData()]);
    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayersData = async () => {
    const { femalePlayers: females, malePlayers: males } = await loadPlayers();
    setFemalePlayers(females);
    setMalePlayers(males);
    
    // If players were just initialized, also initialize matches
    if (females.length === 0 && males.length === 0) {
      // Wait a moment for players to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeMatches();
      await loadMatchesData();
    }
  };

  const loadMatchesData = async () => {
    const { femaleMatches: females, maleMatches: males } = await loadMatches();
    setFemaleMatches(females);
    setMaleMatches(males);
  };

  const loadFinalMatchData = async () => {
    const finalMatch = await loadFinalMatch();
    
    if (finalMatch) {
      setFinalMatchScores({
        team1: [finalMatch.team1_set1, finalMatch.team1_set2, finalMatch.team1_set3],
        team2: [finalMatch.team2_set1, finalMatch.team2_set2, finalMatch.team2_set3],
      });
      setFinalMatchSubmitted(finalMatch.is_submitted);
      
      if (finalMatch.winner_team) {
        setFinalMatchWinner({
          team: finalMatch.winner_team as 'team1' | 'team2',
          malePlayer: finalMatch.male_winner || '',
          femalePlayer: finalMatch.female_winner || '',
          losingMalePlayer: finalMatch.male_runner_up || '',
          losingFemalePlayer: finalMatch.female_runner_up || ''
        });
      }
    }
  };

  const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female') => {
    const matchId = await updateMatchScoreUtil(matchIndex, score1, score2, gender);
    
    if (matchId) {
      // Update player points
      await updatePlayerPointsFromMatch(matchId, score1, score2);
    }
  };

  const updateFinalMatch = async (scores: FinalMatchScores) => {
    await updateFinalMatchUtil(scores, malePlayers, femalePlayers);
  };

  const resetAllDataAndReload = async () => {
    await resetAllData();
    await loadTournamentData();
  };

  return {
    femalePlayers,
    malePlayers,
    femaleMatches,
    maleMatches,
    finalMatchScores,
    finalMatchSubmitted,
    finalMatchWinner,
    isLoading,
    updateMatchScore,
    updateFinalMatch,
    resetAllData: resetAllDataAndReload,
    setFinalMatchScores
  };
};

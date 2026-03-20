import { useEffect } from 'react';
import { useTournamentState } from './useTournamentState';
import { useTournamentRealtimeSubscriptions } from './useTournamentRealtimeSubscriptions';
import { useTournamentActions } from './useTournamentActions';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/firebaseUtils';

export const useTournamentData = () => {
  const state = useTournamentState();
  
  // Define loaders inline
  const loadPlayersData = async () => {
    const result = await loadPlayers() as any;
    state.setFemalePlayers(result.femalePlayers);
    state.setMalePlayers(result.malePlayers);
  };
  
  const loadMatchesData = async () => {
    const result = await loadMatches() as any;
    state.setFemaleMatches(result.femaleMatches);
    state.setMaleMatches(result.maleMatches);
  };
  
  const loadFinalMatchData = async () => {
    const result = await loadFinalMatch() as any;
    state.setFinalMatchScores(result.finalMatchScores);
    state.setFinalMatchSubmitted(result.finalMatchSubmitted);
    state.setFinalMatchWinner(result.finalMatchWinner);
  };
  
  const loadTournamentData = async () => {
    state.setIsLoading(true);
    try {
      await loadPlayersData();
      await loadMatchesData();
      await loadFinalMatchData();
    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      state.setIsLoading(false);
    }
  };

  const actions = useTournamentActions({
    loadPlayersData,
    loadMatchesData,
    loadTournamentData,
    malePlayers: state.malePlayers,
    femalePlayers: state.femalePlayers,
  });

  // Initialize data on mount
  useEffect(() => {
    loadTournamentData();
  }, []);

  // Set up real-time subscriptions
  useTournamentRealtimeSubscriptions({
    loadPlayersData,
    loadMatchesData,
    loadFinalMatchData,
  });

  return {
    // State
    femalePlayers: state.femalePlayers,
    malePlayers: state.malePlayers,
    femaleMatches: state.femaleMatches,
    maleMatches: state.maleMatches,
    finalMatchScores: state.finalMatchScores,
    finalMatchSubmitted: state.finalMatchSubmitted,
    finalMatchWinner: state.finalMatchWinner,
    isLoading: state.isLoading,
    // Actions
    updateMatchScore: actions.updateMatchScore,
    updateFinalMatch: actions.updateFinalMatch,
    resetScores: actions.resetScores,
    resetAllData: actions.resetAllData,
    retryMatchInitialization: () => Promise.resolve(),
    setFinalMatchScores: state.setFinalMatchScores,
    loadTournamentData,
  };
};
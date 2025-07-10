import { useEffect } from 'react';
import { useTournamentState } from './useTournamentState';
import { useTournamentDataLoaders } from './useTournamentDataLoaders';
import { useTournamentRealtimeSubscriptions } from './useTournamentRealtimeSubscriptions';
import { useTournamentActions } from './useTournamentActions';

export const useTournamentData = () => {
  const state = useTournamentState();
  
  const loaders = useTournamentDataLoaders({
    setFemalePlayers: state.setFemalePlayers,
    setMalePlayers: state.setMalePlayers,
    setFemaleMatches: state.setFemaleMatches,
    setMaleMatches: state.setMaleMatches,
    setFinalMatchScores: state.setFinalMatchScores,
    setFinalMatchSubmitted: state.setFinalMatchSubmitted,
    setFinalMatchWinner: state.setFinalMatchWinner,
    setIsLoading: state.setIsLoading,
    femalePlayers: state.femalePlayers,
    malePlayers: state.malePlayers,
  });

  const actions = useTournamentActions({
    loadPlayersData: loaders.loadPlayersData,
    loadMatchesData: loaders.loadMatchesData,
    loadTournamentData: loaders.loadTournamentData,
    malePlayers: state.malePlayers,
    femalePlayers: state.femalePlayers,
  });

  // Initialize data on mount
  useEffect(() => {
    loaders.loadTournamentData();
  }, []);

  // Set up real-time subscriptions
  useTournamentRealtimeSubscriptions({
    loadPlayersData: loaders.loadPlayersData,
    loadMatchesData: loaders.loadMatchesData,
    loadFinalMatchData: loaders.loadFinalMatchData,
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
    retryMatchInitialization: loaders.retryMatchInitialization,
    setFinalMatchScores: state.setFinalMatchScores,
    loadTournamentData: loaders.loadTournamentData,
  };
};
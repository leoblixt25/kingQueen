import { useEffect } from 'react';
import { useTournamentState } from './useTournamentState';
import { useTournamentRealtimeSubscriptions } from './useTournamentRealtimeSubscriptions';
import { useTournamentActions } from './useTournamentActions';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/firebaseUtils';

export const useTournamentData = () => {
  const state = useTournamentState();
  
  // Define loaders inline
  const loadPlayersData = async () => {
    try {
      console.log('🔄 Loading players...');
      const result = await loadPlayers() as any;
      state.setFemalePlayers(result.femalePlayers);
      state.setMalePlayers(result.malePlayers);
      console.log('✅ Players loaded:', result.femalePlayers.length + result.malePlayers.length, 'players');
    } catch (error) {
      console.error('❌ Error loading players:', error);
      throw error;
    }
  };
  
  const loadMatchesData = async () => {
    try {
      console.log('🔄 Loading matches...');
      const result = await loadMatches() as any;
      state.setFemaleMatches(result.femaleMatches);
      state.setMaleMatches(result.maleMatches);
      console.log('✅ Matches loaded:', result.femaleMatches.length + result.maleMatches.length, 'matches');
    } catch (error) {
      console.error('❌ Error loading matches:', error);
      throw error;
    }
  };
  
  const loadFinalMatchData = async () => {
    try {
      console.log('🔄 Loading final match...');
      const result = await loadFinalMatch() as any;
      state.setFinalMatchScores(result.finalMatchScores);
      state.setFinalMatchSubmitted(result.finalMatchSubmitted);
      state.setFinalMatchWinner(result.finalMatchWinner);
      console.log('✅ Final match loaded');
    } catch (error) {
      console.error('❌ Error loading final match:', error);
      throw error;
    }
  };
  
  const loadTournamentData = async () => {
    console.log('🚀 Starting tournament data load...');
    state.setIsLoading(true);
    try {
      await loadPlayersData();
      await loadMatchesData();
      await loadFinalMatchData();
      console.log('✅ All tournament data loaded successfully!');
    } catch (error) {
      console.error('❌ Tournament data load failed:', error);
      // Still set loading to false even on error to prevent infinite loading
    } finally {
      state.setIsLoading(false);
      console.log('🏁 Loading complete');
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
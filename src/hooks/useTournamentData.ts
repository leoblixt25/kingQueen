import { useEffect } from 'react';
import { useTournamentState } from './useTournamentState';
import { useTournamentRealtimeSubscriptions } from './useTournamentRealtimeSubscriptions';
import { useTournamentActions } from './useTournamentActions';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/firebaseUtils';

// Timeout for loading operations (5 seconds)
const LOADING_TIMEOUT = 5000;

export const useTournamentData = () => {
  const state = useTournamentState();
  
  // Define loaders inline
  const loadPlayersData = async () => {
    console.log('🔄 [LOAD PLAYERS] Starting to fetch players...');
    try {
      const result = await loadPlayers() as any;
      state.setFemalePlayers(result.femalePlayers);
      state.setMalePlayers(result.malePlayers);
      console.log('✅ [LOAD PLAYERS] Success:', result.femalePlayers.length + result.malePlayers.length, 'players');
    } catch (error) {
      console.error('❌ [LOAD PLAYERS] Failed:', error);
      throw error;
    }
  };
  
  const loadMatchesData = async () => {
    console.log('🔄 [LOAD MATCHES] Starting to fetch matches...');
    try {
      const result = await loadMatches() as any;
      state.setFemaleMatches(result.femaleMatches);
      state.setMaleMatches(result.maleMatches);
      console.log('✅ [LOAD MATCHES] Success:', result.femaleMatches.length + result.maleMatches.length, 'matches');
    } catch (error) {
      console.error('❌ [LOAD MATCHES] Failed:', error);
      throw error;
    }
  };
  
  const loadFinalMatchData = async () => {
    console.log('🔄 [LOAD FINAL] Starting to fetch final match...');
    try {
      const result = await loadFinalMatch() as any;
      state.setFinalMatchScores(result.finalMatchScores);
      state.setFinalMatchSubmitted(result.finalMatchSubmitted);
      state.setFinalMatchWinner(result.finalMatchWinner);
      console.log('✅ [LOAD FINAL] Success');
    } catch (error) {
      console.error('❌ [LOAD FINAL] Failed:', error);
      throw error;
    }
  };
  
  const loadTournamentData = async () => {
    console.log('🚀 [TOURNAMENT LOAD] Starting tournament data load...');
    state.setIsLoading(true);
    
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ [TOURNAMENT LOAD] TIMEOUT - Loading took more than 5 seconds!');
      abortController.abort();
      state.setIsLoading(false);
    }, LOADING_TIMEOUT);
    
    try {
      // Load all data in parallel for faster loading
      console.log('📊 [TOURNAMENT LOAD] Fetching all collections in parallel...');
      
      const [playersResult, matchesResult, finalResult] = await Promise.allSettled([
        loadPlayersData(),
        loadMatchesData(),
        loadFinalMatchData()
      ]);
      
      // Log individual results
      if (playersResult.status === 'fulfilled') {
        console.log('✅ [TOURNAMENT LOAD] Players loaded successfully');
      } else {
        console.error('❌ [TOURNAMENT LOAD] Players failed:', playersResult.reason);
      }
      
      if (matchesResult.status === 'fulfilled') {
        console.log('✅ [TOURNAMENT LOAD] Matches loaded successfully');
      } else {
        console.error('❌ [TOURNAMENT LOAD] Matches failed:', matchesResult.reason);
      }
      
      if (finalResult.status === 'fulfilled') {
        console.log('✅ [TOURNAMENT LOAD] Final match loaded successfully');
      } else {
        console.error('❌ [TOURNAMENT LOAD] Final match failed:', finalResult.reason);
      }
      
      // Check if at least one collection loaded successfully
      const hasSomeData = 
        playersResult.status === 'fulfilled' || 
        matchesResult.status === 'fulfilled' || 
        finalResult.status === 'fulfilled';
      
      if (hasSomeData) {
        console.log('✅ [TOURNAMENT LOAD] Partial data loaded - continuing with app');
      } else {
        console.error('❌ [TOURNAMENT LOAD] ALL collections failed!');
      }
      
      console.log('✅ [TOURNAMENT LOAD] All tournament data load attempts complete!');
    } catch (error) {
      console.error('❌ [TOURNAMENT LOAD] Unexpected error:', error);
    } finally {
      clearTimeout(timeoutId);
      // ALWAYS set loading to false, even if errors occurred
      state.setIsLoading(false);
      console.log('🏁 [TOURNAMENT LOAD] Loading state cleared - App ready');
    }
  };

  const actions = useTournamentActions({
    loadPlayersData,
    loadMatchesData,
    loadTournamentData,
    malePlayers: state.malePlayers,
    femalePlayers: state.femalePlayers,
  });

  // Initialize data on mount - runs ONCE
  useEffect(() => {
    console.log('💡 [INIT] Tournament data hook mounted - starting initial load');
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
import { useEffect, useCallback } from 'react';
import { useTournamentState } from './useTournamentState';
import { useTournamentRealtimeSubscriptions } from './useTournamentRealtimeSubscriptions';
import { useTournamentActions } from './useTournamentActions';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/firebaseUtils';

// Timeout for loading operations (5 seconds)
const LOADING_TIMEOUT = 5000;

export const useTournamentData = () => {
  const state = useTournamentState();
  
  // Define loaders inline - wrapped in useCallback to prevent recreation
  const loadPlayersData = useCallback(async () => {
    console.log('🔄 [LOAD PLAYERS] Starting to fetch players...');
    try {
      const result = await loadPlayers() as any;
      console.log('📊 [LOAD PLAYERS] Raw result:', result);
      // Use functional updates to avoid dependency issues
      state.setFemalePlayers(prev => {
        console.log('👥 Setting female players:', result.femalePlayers.length);
        return result.femalePlayers;
      });
      state.setMalePlayers(prev => {
        console.log('👥 Setting male players:', result.malePlayers.length);
        return result.malePlayers;
      });
      console.log('✅ [LOAD PLAYERS] Success:', result.femalePlayers.length + result.malePlayers.length, 'players');
    } catch (error) {
      console.error('❌ [LOAD PLAYERS] Failed:', error);
      throw error;
    }
  }, []); // Empty deps - using functional updates
  
  const loadMatchesData = useCallback(async () => {
    console.log('🔄 [LOAD MATCHES] Starting to fetch matches...');
    try {
      const result = await loadMatches() as any;
      console.log('📊 [LOAD MATCHES] Raw result:', result);
      // Use functional updates to avoid dependency issues
      state.setFemaleMatches(prev => {
        console.log('🏐 Setting female matches:', result.femaleMatches.length);
        return result.femaleMatches;
      });
      state.setMaleMatches(prev => {
        console.log('🏐 Setting male matches:', result.maleMatches.length);
        return result.maleMatches;
      });
      console.log('✅ [LOAD MATCHES] Success:', result.femaleMatches.length + result.maleMatches.length, 'matches');
    } catch (error) {
      console.error('❌ [LOAD MATCHES] Failed:', error);
      throw error;
    }
  }, []); // Empty deps - using functional updates
  
  const loadFinalMatchData = useCallback(async () => {
    console.log('🔄 [LOAD FINAL] Starting to fetch final match...');
    try {
      const result = await loadFinalMatch() as any;
      console.log('📊 [LOAD FINAL] Raw result:', result);
      // Use functional updates to avoid dependency issues
      state.setFinalMatchScores(prev => {
        console.log('🏆 Setting final match scores');
        return result.finalMatchScores;
      });
      state.setFinalMatchSubmitted(prev => {
        console.log('🏆 Setting final match submitted:', result.finalMatchSubmitted);
        return result.finalMatchSubmitted;
      });
      state.setFinalMatchWinner(prev => {
        console.log('🏆 Setting final match winner:', result.finalMatchWinner);
        return result.finalMatchWinner;
      });
      console.log('✅ [LOAD FINAL] Success');
    } catch (error) {
      console.error('❌ [LOAD FINAL] Failed:', error);
      throw error;
    }
  }, []); // Empty deps - using functional updates
  
  const loadTournamentData = useCallback(async () => {
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
  }, [loadPlayersData, loadMatchesData, loadFinalMatchData, state.setIsLoading]);

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
    loadPlayersData,
    loadMatchesData,
    loadFinalMatchData,
  };
};
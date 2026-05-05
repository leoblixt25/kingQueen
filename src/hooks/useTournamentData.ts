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
    const startTime = Date.now();
    console.log('🔄 [LOAD PLAYERS] Starting to fetch players...');
    try {
      const result = await loadPlayers() as any;
      state.setFemalePlayers(result.femalePlayers);
      state.setMalePlayers(result.malePlayers);
      const duration = Date.now() - startTime;
      console.log(`✅ [LOAD PLAYERS] Success: ${result.femalePlayers.length + result.malePlayers.length} players (${duration}ms)`);
    } catch (error) {
      console.error('❌ [LOAD PLAYERS] Failed:', error);
      throw error;
    }
  }, []);
  
  const loadMatchesData = useCallback(async () => {
    console.log('🔄 [LOAD MATCHES] Starting to fetch matches...');
    try {
      const result = await loadMatches() as any;

      // INVARIANT CHECK: Never allow empty matches if they were returned
      // If loadMatches returns empty, it means regeneration failed or players don't exist
      const totalMatches = result.femaleMatches.length + result.maleMatches.length;
      if (totalMatches === 0) {
        console.warn('⚠️ [LOAD MATCHES] No matches returned - check if players exist and draw is complete');
      }

      state.setFemaleMatches(result.femaleMatches);
      state.setMaleMatches(result.maleMatches);
      console.log('✅ [LOAD MATCHES] Success:', totalMatches, 'matches');
    } catch (error) {
      console.error('❌ [LOAD MATCHES] Failed:', error);
      throw error;
    }
  }, []);
  
  const loadFinalMatchData = useCallback(async () => {
    console.log('🔄 [LOAD FINAL] Starting to fetch final match...');
    try {
      const result = await loadFinalMatch() as any;
      
      // Transform Firestore data into the expected format
      let finalMatchScores = { team1: [null, null, null], team2: [null, null, null] } as any;
      let finalMatchSubmitted = false;
      let finalMatchWinner = null;
      
      if (result) {
        console.log('📊 [LOAD FINAL] Raw final match data:', result);
        
        // Extract set scores from Firestore fields
        const team1Set1 = result.team1_set1;
        const team1Set2 = result.team1_set2;
        const team1Set3 = result.team1_set3;
        const team2Set1 = result.team2_set1;
        const team2Set2 = result.team2_set2;
        const team2Set3 = result.team2_set3;
        
        console.log('📊 [LOAD FINAL] Raw sets - T1:', team1Set1, team1Set2, team1Set3);
        console.log('📊 [LOAD FINAL] Raw sets - T2:', team2Set1, team2Set2, team2Set3);
        
        finalMatchScores = {
          team1: [
            team1Set1 !== undefined ? (team1Set1 === null ? null : team1Set1) : null,
            team1Set2 !== undefined ? (team1Set2 === null ? null : team1Set2) : null,
            team1Set3 !== undefined ? (team1Set3 === null ? null : team1Set3) : null
          ],
          team2: [
            team2Set1 !== undefined ? (team2Set1 === null ? null : team2Set1) : null,
            team2Set2 !== undefined ? (team2Set2 === null ? null : team2Set2) : null,
            team2Set3 !== undefined ? (team2Set3 === null ? null : team2Set3) : null
          ]
        };
        
        console.log('📊 [LOAD FINAL] Processed team1 scores:', finalMatchScores.team1);
        console.log('📊 [LOAD FINAL] Processed team2 scores:', finalMatchScores.team2);
        
        finalMatchSubmitted = result.is_completed || false;
        
        // Store just the winning team number - we'll calculate names when displaying
        if (result.winner_team) {
          finalMatchWinner = {
            winningTeam: result.winner_team,
            completedAt: result.completed_at || null
          };
        }
        
        console.log('📊 [LOAD FINAL] Transformed scores:', finalMatchScores);
        console.log('📊 [LOAD FINAL] Submitted:', finalMatchSubmitted, 'Winner:', finalMatchWinner);
      }
      
      state.setFinalMatchScores(finalMatchScores);
      state.setFinalMatchSubmitted(finalMatchSubmitted);
      state.setFinalMatchWinner(finalMatchWinner);
      console.log('✅ [LOAD FINAL] Success');
    } catch (error) {
      console.error('❌ [LOAD FINAL] Failed:', error);
      throw error;
    }
  }, []);
  
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
    loadFinalMatchData,
    loadTournamentData,
    malePlayers: state.malePlayers,
    femalePlayers: state.femalePlayers,
    setFinalMatchSubmitted: state.setFinalMatchSubmitted,
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
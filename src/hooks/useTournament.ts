import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { TournamentState, Player, Match, FinalMatch, Gender } from '@/types';
import { calculateRankings, getTopPlayers } from '@/utils/calculations';
import { initializeTournament, resetTournamentScores, updateMatchScore as updateMatchScoreUtil, createFinalMatch } from '@/utils/tournament';

const initialState: TournamentState = {
  players: { male: [], female: [] },
  matches: { male: [], female: [] },
  rankings: { male: [], female: [] },
  finalMatch: null,
  currentPhase: 'setup',
  isLoading: true,
  error: null,
};

export function useTournament() {
  const [state, setState] = useState<TournamentState>(initialState);

  // Load all tournament data
  const loadTournamentData = useCallback(async () => {
    console.log('📊 Loading tournament data...');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('position');

      if (playersError) throw playersError;

      // Load matches with player details
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:players!matches_player1_id_fkey(*),
          player2:players!matches_player2_id_fkey(*),
          player3:players!matches_player3_id_fkey(*),
          player4:players!matches_player4_id_fkey(*)
        `)
        .order('match_number');

      if (matchesError) throw matchesError;

      // Load final match
      const { data: finalMatch, error: finalError } = await supabase
        .from('final_matches')
        .select(`
          *,
          male_king:players!final_matches_male_king_id_fkey(*),
          female_queen:players!final_matches_female_queen_id_fkey(*),
          male_prince:players!final_matches_male_prince_id_fkey(*),
          female_princess:players!final_matches_female_princess_id_fkey(*)
        `)
        .single();

      // Organize data
      const malePlayer = (players || []).filter(p => p.gender === 'male');
      const femalePlayers = (players || []).filter(p => p.gender === 'female');
      const maleMatches = (matches || []).filter(m => m.gender === 'male');
      const femaleMatches = (matches || []).filter(m => m.gender === 'female');

      // Calculate rankings
      const maleRankings = calculateRankings(malePlayer);
      const femaleRankings = calculateRankings(femalePlayers);

      // Determine phase
      const totalMatches = (matches || []).length;
      const completedMatches = (matches || []).filter(m => m.is_completed).length;
      let currentPhase = 'setup';
      
      if (players?.length === 16 && matches?.length === 28) {
        if (completedMatches === totalMatches) {
          currentPhase = finalMatch?.data ? 'completed' : 'final';
        } else if (completedMatches > 0) {
          currentPhase = 'active';
        }
      }

      setState({
        players: { male: malePlayer, female: femalePlayers },
        matches: { male: maleMatches, female: femaleMatches },
        rankings: { male: maleRankings, female: femaleRankings },
        finalMatch: finalError ? null : finalMatch.data,
        currentPhase,
        isLoading: false,
        error: null,
      });

      console.log('✅ Tournament data loaded successfully');

    } catch (error) {
      console.error('❌ Failed to load tournament data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }));
    }
  }, []);

  // Initialize tournament if needed
  const initialize = useCallback(async () => {
    console.log('🚀 Initializing tournament...');
    const result = await initializeTournament();
    if (result.success) {
      await loadTournamentData();
    }
    return result;
  }, [loadTournamentData]);

  // Update match score
  const updateMatchScore = useCallback(async (matchId: string, score1: number, score2: number) => {
    console.log(`🏐 Updating match score: ${matchId} -> ${score1}:${score2}`);
    const result = await updateMatchScoreUtil(matchId, score1, score2);
    if (result.success) {
      // Data will be automatically updated via real-time subscription
    }
    return result;
  }, []);

  // Reset scores
  const resetScores = useCallback(async () => {
    console.log('🔄 Resetting tournament scores...');
    const result = await resetTournamentScores();
    if (result.success) {
      await loadTournamentData();
    }
    return result;
  }, [loadTournamentData]);

  // Generate final match
  const generateFinalMatch = useCallback(async () => {
    console.log('👑 Generating final match...');
    const topPlayers = getTopPlayers(state.rankings);
    
    if (!topPlayers.team1.male || !topPlayers.team1.female || 
        !topPlayers.team2.female || !topPlayers.team2.male) {
      return { success: false, error: 'Not enough players for final match' };
    }

    const result = await createFinalMatch(
      topPlayers.team1.male.id,    // King
      topPlayers.team2.female.id,  // Queen
      topPlayers.team2.male.id,    // Prince
      topPlayers.team1.female.id   // Princess
    );

    if (result.success) {
      await loadTournamentData();
    }
    return result;
  }, [state.rankings, loadTournamentData]);

  // Set up real-time subscriptions
  useEffect(() => {
    console.log('🔔 Setting up real-time subscriptions...');

    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        console.log('🔔 Players updated, reloading...');
        loadTournamentData();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        console.log('🔔 Matches updated, reloading...');
        loadTournamentData();
      })
      .subscribe();

    const finalChannel = supabase
      .channel('final-matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, () => {
        console.log('🔔 Final match updated, reloading...');
        loadTournamentData();
      })
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up subscriptions...');
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalChannel);
    };
  }, [loadTournamentData]);

  // Load data on mount
  useEffect(() => {
    loadTournamentData();
  }, [loadTournamentData]);

  return {
    ...state,
    actions: {
      initialize,
      updateMatchScore,
      resetScores,
      generateFinalMatch,
      refresh: loadTournamentData,
    },
  };
}
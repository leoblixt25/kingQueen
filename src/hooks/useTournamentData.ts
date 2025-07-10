import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, Match, FinalMatchScores, FinalMatchWinner } from '@/types';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/supabaseUtils';
import { initializePlayers, initializeMatches, resetScoresOnly, fullTournamentReset } from '@/utils/simpleTournamentUtils';
import { updateMatchScore as updateMatchScoreUtil } from '@/utils/matchUtils';
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

  useEffect(() => {
    loadTournamentData();
  }, []);

  useEffect(() => {
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        console.log('Players table changed - reloading players data');
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
    try {
      await loadPlayersData();
      await loadMatchesData();
      await loadFinalMatchData();
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

    if (females.length === 0 && males.length === 0) {
      await initializePlayers();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeMatches();
      await loadMatchesData();
    }
  };

  const loadMatchesData = async () => {
    const { femaleMatches: females, maleMatches: males } = await loadMatches();
    setFemaleMatches(females);
    setMaleMatches(males);

    if (females.length === 0 && males.length === 0 && (femalePlayers.length > 0 || malePlayers.length > 0)) {
      const { data: playersCheck } = await supabase.from('players').select('id, gender');
      const femaleCount = playersCheck?.filter(p => p.gender === 'female').length || 0;
      const maleCount = playersCheck?.filter(p => p.gender === 'male').length || 0;

      if (femaleCount === 8 && maleCount === 8) {
        await initializeMatches();
        const { femaleMatches: newFemales, maleMatches: newMales } = await loadMatches();
        setFemaleMatches(newFemales);
        setMaleMatches(newMales);
      }
    }
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

  const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female', isEdit: boolean = false) => {
    try {
      const matchId = await updateMatchScoreUtil(matchIndex, score1, score2, gender);
      if (matchId) {
        await updatePlayerPointsFromMatch(matchId, score1, score2, isEdit);
        await loadPlayersData();
        await loadMatchesData();
      } else {
        console.error('Failed to update match score - no match ID returned');
      }
    } catch (error) {
      console.error('Error in updateMatchScore:', error);
    }
  };

  const updateFinalMatch = async (scores: FinalMatchScores) => {
    await updateFinalMatchUtil(scores, malePlayers, femalePlayers);
  };

  const resetScoresAndReload = async () => {
    await resetScoresOnly();
    await loadTournamentData();
  };

  const resetAllDataAndReload = async () => {
    await fullTournamentReset();
    await loadTournamentData();
  };

  const retryMatchInitialization = async () => {
    setIsLoading(true);
    try {
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeMatches();
      await loadMatchesData();
    } catch (error) {
      console.error('Error in retry match initialization:', error);
    } finally {
      setIsLoading(false);
    }
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
    resetScores: resetScoresAndReload,
    resetAllData: resetAllDataAndReload,
    retryMatchInitialization,
    setFinalMatchScores
  };
};

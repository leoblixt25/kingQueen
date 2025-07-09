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
    console.log('Loading tournament data...');

    try {
      console.log('Starting to load players data...');
      await loadPlayersData();
      console.log('Players data loaded, loading matches data...');
      await loadMatchesData();
      console.log('Matches data loaded, loading final match data...');
      await loadFinalMatchData();
      console.log('All tournament data loaded successfully');
    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      console.log('Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const loadPlayersData = async () => {
    console.log('Loading players from supabase...');
    const { femalePlayers: females, malePlayers: males } = await loadPlayers();
    console.log('Players loaded:', { females: females.length, males: males.length });
    console.log('Female players:', females);
    console.log('Male players:', males);
    setFemalePlayers(females);
    setMalePlayers(males);

    if (females.length === 0 && males.length === 0) {
      console.log('No players found, initializing matches...');
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
      console.log('Players exist but no matches found, initializing matches...');

      const { data: playersCheck } = await supabase.from('players').select('id, gender');
      const femaleCount = playersCheck?.filter(p => p.gender === 'female').length || 0;
      const maleCount = playersCheck?.filter(p => p.gender === 'male').length || 0;

      if (femaleCount === 8 && maleCount === 8) {
        await initializeMatches();
        const { femaleMatches: newFemales, maleMatches: newMales } = await loadMatches();
        setFemaleMatches(newFemales);
        setMaleMatches(newMales);
      } else {
        console.log(`Cannot initialize matches - incorrect player count: ${femaleCount} female, ${maleCount} male`);
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

  const updateMatchScore = async (
    matchIndex: number,
    score1: number,
    score2: number,
    gender: 'male' | 'female',
    isEdit: boolean = false
  ) => {
    console.log(`useTournamentData: Updating match score ${matchIndex} with scores ${score1}-${score2} for ${gender}, isEdit=${isEdit}`);

    try {
      const matchId = await updateMatchScoreUtil(matchIndex, score1, score2, gender);

      if (matchId) {
        console.log('Match score updated, now updating player points...');
        await updatePlayerPointsFromMatch(matchId, score1, score2, isEdit);
        console.log('Player points updated successfully');

        // ✅ Manually reload players and matches
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

  const resetAllDataAndReload = async () => {
    await resetAllData();
    await loadTournamentData();
  };

  const retryMatchInitialization = async () => {
    console.log('Manually retrying match initialization...');
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
    resetAllData: resetAllDataAndReload,
    retryMatchInitialization,
    setFinalMatchScores
  };
};

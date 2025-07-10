import { supabase } from '@/integrations/supabase/client';
import { Player, Match } from '@/types';
import { loadPlayers, loadMatches, loadFinalMatch } from '@/utils/supabaseUtils';
import { initializePlayers } from '@/utils/playerInitUtils';
import { initializeMatches } from '@/utils/matchInitUtils';

interface UseTournamentDataLoadersProps {
  setFemalePlayers: (players: Player[]) => void;
  setMalePlayers: (players: Player[]) => void;
  setFemaleMatches: (matches: Match[]) => void;
  setMaleMatches: (matches: Match[]) => void;
  setFinalMatchScores: (scores: any) => void;
  setFinalMatchSubmitted: (submitted: boolean) => void;
  setFinalMatchWinner: (winner: any) => void;
  setIsLoading: (loading: boolean) => void;
  femalePlayers: Player[];
  malePlayers: Player[];
}

export const useTournamentDataLoaders = ({
  setFemalePlayers,
  setMalePlayers,
  setFemaleMatches,
  setMaleMatches,
  setFinalMatchScores,
  setFinalMatchSubmitted,
  setFinalMatchWinner,
  setIsLoading,
  femalePlayers,
  malePlayers,
}: UseTournamentDataLoadersProps) => {
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
    console.log('🔄 Loading players data...');
    const { femalePlayers: females, malePlayers: males } = await loadPlayers();
    console.log('📊 Players loaded - Females:', females.length, 'Males:', males.length);
    console.log('📊 Female players data:', females.map(p => ({ name: p.name, points: p.points, totalScores: p.totalScores })));
    console.log('📊 Male players data:', males.map(p => ({ name: p.name, points: p.points, totalScores: p.totalScores })));
    setFemalePlayers(females);
    setMalePlayers(males);

    if (females.length === 0 && males.length === 0) {
      await initializePlayers();
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Reload players after initialization
      const { femalePlayers: newFemales, malePlayers: newMales } = await loadPlayers();
      setFemalePlayers(newFemales);
      setMalePlayers(newMales);
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
    console.log('Loading final match...');
    const finalMatch = await loadFinalMatch();

    if (finalMatch && finalMatch.is_completed) {
      // Load actual set scores from database
      setFinalMatchScores({
        team1: [
          finalMatch.team1_set1 || null,
          finalMatch.team1_set2 || null, 
          finalMatch.team1_set3 || null
        ],
        team2: [
          finalMatch.team2_set1 || null,
          finalMatch.team2_set2 || null,
          finalMatch.team2_set3 || null
        ],
      });
      setFinalMatchSubmitted(true);

      if (finalMatch.winner_team) {
        // Get player names from the database using the stored IDs
        const { data: players } = await supabase.from('players').select('id, name');
        const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || '';
        
        setFinalMatchWinner({
          team: finalMatch.winner_team === 1 ? 'team1' : 'team2',
          malePlayer: getPlayerName(finalMatch.male_king_id || ''),
          femalePlayer: getPlayerName(finalMatch.female_queen_id || ''), 
          losingMalePlayer: getPlayerName(finalMatch.male_prince_id || ''),
          losingFemalePlayer: getPlayerName(finalMatch.female_princess_id || '')
        });
      }
    } else {
      // Reset to default state if no completed final match
      setFinalMatchScores({
        team1: [null, null, null],
        team2: [null, null, null],
      });
      setFinalMatchSubmitted(false);
      setFinalMatchWinner(null);
    }
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
    loadTournamentData,
    loadPlayersData,
    loadMatchesData,
    loadFinalMatchData,
    retryMatchInitialization,
  };
};
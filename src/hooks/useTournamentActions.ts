import { Player, FinalMatchScores } from '@/types';
import { updateMatchScore as updateMatchScoreUtil } from '@/utils/matchUtils';
import { updatePlayerPointsFromMatch } from '@/utils/playerUtils';
import { updateFinalMatch as updateFinalMatchUtil } from '@/utils/finalMatchUtils';
import { resetScoresOnly, fullTournamentReset } from '@/utils/resetUtils';

interface UseTournamentActionsProps {
  loadPlayersData: () => Promise<void>;
  loadMatchesData: () => Promise<void>;
  loadTournamentData: () => Promise<void>;
  malePlayers: Player[];
  femalePlayers: Player[];
}

export const useTournamentActions = ({
  loadPlayersData,
  loadMatchesData,
  loadTournamentData,
  malePlayers,
  femalePlayers,
}: UseTournamentActionsProps) => {
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
    try {
      await resetScoresOnly();
      // Real-time subscriptions will handle the reload automatically
      // but we can force a reload for immediate feedback
      await loadTournamentData();
    } catch (error) {
      console.error('Error in resetScoresAndReload:', error);
      throw error;
    }
  };

  const resetAllDataAndReload = async () => {
    try {
      await fullTournamentReset();
      // Real-time subscriptions will handle most of the reload
      // but we ensure data is fresh with a manual reload
      await loadTournamentData();
    } catch (error) {
      console.error('Error in resetAllDataAndReload:', error);
      throw error;
    }
  };

  return {
    updateMatchScore,
    updateFinalMatch,
    resetScores: resetScoresAndReload,
    resetAllData: resetAllDataAndReload,
  };
};
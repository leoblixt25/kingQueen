import { Player, FinalMatchScores } from '@/types';
import { updateMatchScore as updateMatchScoreUtil } from '@/utils/matchUtils';
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
    console.log(`🏐 UPDATE MATCH SCORE CALLED: match=${matchIndex}, scores=${score1}-${score2}, gender=${gender}, isEdit=${isEdit}`);
    try {
      const matchId = await updateMatchScoreUtil(matchIndex, score1, score2, gender, isEdit);
      console.log(`🏐 Match updated, ID: ${matchId}`);
      if (matchId) {
        console.log(`🏐 Match updated successfully, database trigger will handle player stats automatically`);
        // Database trigger handles player stats calculation automatically
        // No need for manual updatePlayerPointsFromMatch call
        await loadPlayersData();
        await loadMatchesData();
        console.log(`🏐 Data reloaded successfully`);
      } else {
        console.error('Failed to update match score - no match ID returned');
      }
    } catch (error) {
      console.error('Error in updateMatchScore:', error);
    }
  };

  const updateFinalMatch = async (scores: FinalMatchScores) => {
    console.log('🏆 Final match update called with scores:', scores);
    try {
      await updateFinalMatchUtil(scores, malePlayers, femalePlayers);
      console.log('🏆 Final match updated successfully');
      // Reload tournament data to get the updated final match state
      await loadTournamentData();
    } catch (error) {
      console.error('🏆 Error updating final match:', error);
      throw error;
    }
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
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
    console.log('🏆 Players available - Male:', malePlayers.length, 'Female:', femalePlayers.length);
    try {
      // Determine tournament type based on player data
      const hasMalePlayers = malePlayers && malePlayers.length > 0;
      const hasFemalePlayers = femalePlayers && femalePlayers.length > 0;
      
      let tournamentType = 'mixed'; // default
      if (hasMalePlayers && !hasFemalePlayers) {
        tournamentType = 'male';
      } else if (!hasMalePlayers && hasFemalePlayers) {
        tournamentType = 'female';
      }
      
      console.log('🏆 Tournament type determined:', tournamentType);
      await updateFinalMatchUtil(scores, malePlayers, femalePlayers, tournamentType);
      console.log('🏆 Final match updated successfully');
      // DON'T reload immediately - let real-time subscriptions handle it
      // This prevents race conditions where we load before data is saved
      console.log('🏆 Waiting for real-time update...');
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
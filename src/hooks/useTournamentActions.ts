import { Player, FinalMatchScores } from '@/types';
import { updateMatchScore as updateMatchScoreUtil } from '@/utils/matchUtils';
import { updateFinalMatch as updateFinalMatchUtil } from '@/utils/finalMatchUtils';
import { resetScoresOnly, fullTournamentReset } from '@/utils/resetUtils';

interface UseTournamentActionsProps {
  loadPlayersData: () => Promise<void>;
  loadMatchesData: () => Promise<void>;
  loadFinalMatchData: () => Promise<void>;
  loadTournamentData: () => Promise<void>;
  malePlayers: Player[];
  femalePlayers: Player[];
  setFinalMatchSubmitted?: (submitted: boolean) => void;
}

export const useTournamentActions = ({
  loadPlayersData,
  loadMatchesData,
  loadFinalMatchData,
  loadTournamentData,
  malePlayers,
  femalePlayers,
  setFinalMatchSubmitted,
}: UseTournamentActionsProps) => {
  const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female', isEdit: boolean = false) => {
    console.log(`🏐 UPDATE MATCH SCORE CALLED: match=${matchIndex}, scores=${score1}-${score2}, gender=${gender}, isEdit=${isEdit}`);
    try {
      const matchId = await updateMatchScoreUtil(matchIndex, score1, score2, gender, isEdit);
      console.log(`🏐 Match updated, ID: ${matchId}`);
      if (matchId) {
        console.log(`🏐 Match updated successfully, rankings calculated`);
        // Small delay to ensure Firebase ranking updates are committed before reload
        await new Promise(resolve => setTimeout(resolve, 500));
        // IMMEDIATELY reload players, matches, and final match to show updated rankings and bracket
        await Promise.all([loadPlayersData(), loadMatchesData(), loadFinalMatchData()]);
        console.log(`🏐 Data reloaded immediately with updated rankings and final match bracket`);
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
      
      // Set submitted state immediately to lock the UI
      if (setFinalMatchSubmitted) {
        setFinalMatchSubmitted(true);
        console.log('🏆 Submitted state set to true');
      }
      
      // Let real-time subscriptions handle data refresh naturally
      console.log('🏆 Waiting for real-time update...');
    } catch (error) {
      console.error('🏆 Error updating final match:', error);
      throw error;
    }
  };

  const resetScoresAndReload = async () => {
    try {
      await resetScoresOnly();
      console.log('🔄 [RESET] Scores reset complete, forcing immediate reload...');
      // Force immediate reload instead of waiting for real-time
      await Promise.all([loadPlayersData(), loadMatchesData(), loadTournamentData()]);
      console.log('✅ [RESET] Data reloaded immediately');
    } catch (error) {
      console.error('Error in resetScoresAndReload:', error);
      throw error;
    }
  };

  const resetAllDataAndReload = async () => {
    try {
      console.log('🔄 [FULL RESET] Starting full tournament reset...');
      await fullTournamentReset();
      console.log('🔄 [FULL RESET] Reset complete, waiting for Firebase to stabilize...');
      
      // Wait for Firebase to fully process the reset and reinitialize data
      // This includes: auth deletion, data deletion, player creation, match creation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('🔄 [FULL RESET] Firebase stabilization complete');
      // Note: The actual data loading and retry logic is now handled in Index.tsx
      // This function just performs the reset operation
      console.log('✅ [FULL RESET] Reset operation completed successfully');
    } catch (error) {
      console.error('❌ [FULL RESET] Error:', error);
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
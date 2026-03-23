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
  setFinalMatchSubmitted?: (submitted: boolean) => void;
}

export const useTournamentActions = ({
  loadPlayersData,
  loadMatchesData,
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
        console.log(`🏐 Match updated successfully, database trigger will handle player stats automatically`);
        // IMMEDIATELY reload players and matches to show updated rankings
        await Promise.all([loadPlayersData(), loadMatchesData()]);
        console.log(`🏐 Data reloaded immediately`);
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
      console.log('🔄 [FULL RESET] Reset complete, waiting for data to be ready...');
      
      // Wait a bit longer to ensure all real-time updates have processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🔄 [FULL RESET] Forcing immediate reload of all data...');
      // Force immediate reload - load everything in parallel
      await Promise.all([
        loadPlayersData().then(() => console.log('✅ Players loaded')),
        loadMatchesData().then(() => console.log('✅ Matches loaded')),
        loadTournamentData().then(() => console.log('✅ Tournament data loaded'))
      ]);
      
      console.log('✅ [FULL RESET] All data reloaded successfully');
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
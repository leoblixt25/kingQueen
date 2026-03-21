import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { Player, Match } from '@/types';

/**
 * Calculate rankings from completed matches
 * Updates player points based on match results
 * 
 * Scoring system:
 * - Win = 1 point
 * - Loss = 0 points
 * 
 * Called automatically by Firestore trigger when match is completed
 */
export const calculateRankingsFromMatches = async () => {
  console.log('🏆 [RANKINGS] Starting ranking calculation...');
  
  try {
    // Get all completed matches
    const matchesRef = collection(db, 'matches');
    const completedQuery = query(matchesRef, where('is_completed', '==', true));
    const matchesSnapshot = await getDocs(completedQuery);
    
    console.log(`📊 [RANKINGS] Found ${matchesSnapshot.size} completed matches`);
    
    if (matchesSnapshot.empty) {
      console.log('ℹ️ [RANKINGS] No completed matches yet');
      return;
    }
    
    // Track wins for each player
    const playerWins = new Map<string, { wins: number; totalScores: number; matchesPlayed: number }>();
    
    // Process each match
    matchesSnapshot.docs.forEach(doc => {
      const match = doc.data();
      const winnerScore = Math.max(match.score1 || 0, match.score2 || 0);
      const loserScore = Math.min(match.score1 || 0, match.score2 || 0);
      
      // Determine which team won
      const team1Won = match.score1 > match.score2;
      
      if (team1Won) {
        // Team 1 won - add wins for player1 and player2
        addToPlayerStats(playerWins, match.player1_id, 1, match.score1);
        addToPlayerStats(playerWins, match.player2_id, 1, match.score1);
        // Team 2 lost - add 0 wins for player3 and player4
        addToPlayerStats(playerWins, match.player3_id, 0, match.score2);
        addToPlayerStats(playerWins, match.player4_id, 0, match.score2);
      } else {
        // Team 2 won
        addToPlayerStats(playerWins, match.player3_id, 1, match.score2);
        addToPlayerStats(playerWins, match.player4_id, 1, match.score2);
        // Team 1 lost
        addToPlayerStats(playerWins, match.player1_id, 0, match.score1);
        addToPlayerStats(playerWins, match.player2_id, 0, match.score1);
      }
    });
    
    console.log('📊 [RANKINGS] Player stats calculated:', Object.fromEntries(playerWins));
    
    // Update each player's points in Firestore
    const playersRef = collection(db, 'players');
    const updatePromises = [];
    
    for (const [playerId, stats] of playerWins.entries()) {
      const playerQuery = query(playersRef, where('__name__', '==', playerId));
      const playerSnapshot = await getDocs(playerQuery);
      
      if (!playerSnapshot.empty) {
        const playerDoc = playerSnapshot.docs[0];
        const playerRef = doc(db, 'players', playerId);
        
        // Update points and total_scores
        const updatePromise = updateDoc(playerRef, {
          points: stats.wins,
          total_scores: stats.totalScores
        });
        
        updatePromises.push(updatePromise);
        console.log(`✅ [RANKINGS] Updated ${playerId}: ${stats.wins} wins, ${stats.totalScores} total scores`);
      }
    }
    
    await Promise.all(updatePromises);
    console.log('🎉 [RANKINGS] Rankings updated successfully!');
    
  } catch (error) {
    console.error('❌ [RANKINGS] Error calculating rankings:', error);
  }
};

/**
 * Helper function to track player statistics
 */
const addToPlayerStats = (
  playerWins: Map<string, { wins: number; totalScores: number; matchesPlayed: number }>,
  playerId: string,
  wins: number,
  score: number
) => {
  const current = playerWins.get(playerId) || { wins: 0, totalScores: 0, matchesPlayed: 0 };
  current.wins += wins;
  current.totalScores += score;
  current.matchesPlayed += 1;
  playerWins.set(playerId, current);
};

/**
 * Recalculate all rankings from scratch
 * Use this for manual recalculation if needed
 */
export const recalculateAllRankings = async () => {
  console.log('🔄 [RANKINGS] Recalculating ALL rankings from scratch...');
  await calculateRankingsFromMatches();
};

import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Player, Match } from '@/types';

/**
 * Calculate rankings from completed matches
 * Updates player points based on match results
 * 
 * Scoring system:
 * - Win = 2 points
 * - Loss = 1 point (participation)
 * 
 * Ranking Logic:
 * - Players are ranked by TOTAL POINTS (highest first)
 * - If tied on points, use TOTAL SCORES as tiebreaker (highest first)
 * - Example: Player A (6 pts, 120 score) ranks higher than Player B (6 pts, 115 score)
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
        // Team 1 won - add 2 points for player1 and player2
        addToPlayerStats(playerWins, match.player1_id, 2, match.score1);
        addToPlayerStats(playerWins, match.player2_id, 2, match.score1);
        // Team 2 lost - add 1 point for player3 and player4
        addToPlayerStats(playerWins, match.player3_id, 1, match.score2);
        addToPlayerStats(playerWins, match.player4_id, 1, match.score2);
      } else {
        // Team 2 won - add 2 points for player3 and player4
        addToPlayerStats(playerWins, match.player3_id, 2, match.score2);
        addToPlayerStats(playerWins, match.player4_id, 2, match.score2);
        // Team 1 lost - add 1 point for player1 and player2
        addToPlayerStats(playerWins, match.player1_id, 1, match.score1);
        addToPlayerStats(playerWins, match.player2_id, 1, match.score1);
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
          points: stats.wins,  // Now uses 2 for win, 1 for loss
          total_scores: stats.totalScores
        });
        
        updatePromises.push(updatePromise);
        console.log(`✅ [RANKINGS] Updated ${playerId}: ${stats.wins} wins, ${stats.totalScores} total scores`);
      }
    }
    
    await Promise.all(updatePromises);
    console.log('🎉 [RANKINGS] Rankings updated successfully!');
    
    // Championship Final computes dynamically from live player data
    // No need to store bracket in Firebase - it will update automatically
    // via real-time subscriptions when players collection changes
    
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

/**
 * Update final match bracket based on current rankings
 * Called automatically after every ranking calculation
 */
const updateFinalMatchBracket = async () => {
  try {
    console.log('🏆 [FINAL MATCH BRACKET] Updating bracket with latest rankings...');
    
    // Load current players sorted by rankings
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    const allPlayers: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Separate and sort by points (descending), then total_scores (descending)
    const females = allPlayers
      .filter((p: any) => p.gender === 'female')
      .sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.total_scores || 0) - (a.total_scores || 0);
      });
    
    const males = allPlayers
      .filter((p: any) => p.gender === 'male')
      .sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.total_scores || 0) - (a.total_scores || 0);
      });
    
    // Need at least 2 players from each gender
    if (females.length < 2 || males.length < 2) {
      console.log('⚠️ [FINAL MATCH BRACKET] Not enough players for final match');
      return;
    }
    
    // Get top 2 from each gender
    const rank1Male = males[0];
    const rank2Male = males[1];
    const rank1Female = females[0];
    const rank2Female = females[1];
    
    console.log('🏆 [FINAL MATCH BRACKET] Top ranked players:');
    console.log(`  Male #1: ${rank1Male.name} (${rank1Male.points} pts)`);
    console.log(`  Male #2: ${rank2Male.name} (${rank2Male.points} pts)`);
    console.log(`  Female #1: ${rank1Female.name} (${rank1Female.points} pts)`);
    console.log(`  Female #2: ${rank2Female.name} (${rank2Female.points} pts)`);
    
    // Create teams:
    // Team 1: Rank 1 Male + Rank 2 Female
    // Team 2: Rank 2 Male + Rank 1 Female
    const finalMatchRef = doc(db, 'finalMatches', 'current');
    
    // Check if final match already exists and is completed
    const finalMatchSnap = await getDoc(finalMatchRef);
    if (finalMatchSnap.exists() && finalMatchSnap.data().is_completed) {
      console.log('ℹ️ [FINAL MATCH BRACKET] Final match already completed, not updating');
      return;
    }
    
    // Update/create final match bracket
    await setDoc(finalMatchRef, {
      male_king_id: rank1Male.id,
      female_queen_id: rank2Female.id,
      male_prince_id: rank2Male.id,
      female_princess_id: rank1Female.id,
      team1_score: 0,
      team2_score: 0,
      team1_set1: null,
      team1_set2: null,
      team1_set3: null,
      team2_set1: null,
      team2_set2: null,
      team2_set3: null,
      is_completed: false,
      winner_team: null,
      updated_at: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ [FINAL MATCH BRACKET] Bracket updated successfully');
    console.log(`  Team 1: ${rank1Male.name} + ${rank2Female.name}`);
    console.log(`  Team 2: ${rank2Male.name} + ${rank1Female.name}`);
    console.log('📊 [FINAL MATCH BRACKET] Player IDs stored in Firebase:');
    console.log(`  male_king_id: ${rank1Male.id}`);
    console.log(`  female_queen_id: ${rank2Female.id}`);
    console.log(`  male_prince_id: ${rank2Male.id}`);
    console.log(`  female_princess_id: ${rank1Female.id}`);
    
  } catch (error) {
    console.error('❌ [FINAL MATCH BRACKET] Error updating bracket:', error);
  }
};

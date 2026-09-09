import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

/**
 * CRITICAL: Matches are ONLY created in DrawPage.tsx when user clicks "Start Draw"
 * This file contains NO match generation logic - only match updates
 */

export const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female', isEdit: boolean = false) => {
  console.log(`🏐 [SCORE UPDATE] Starting... match=${matchIndex}, scores=${score1}-${score2}, gender=${gender}, isEdit=${isEdit}`);
  
  // VALIDATION: Ensure scores are valid numbers
  if (score1 === null || score1 === undefined || score2 === null || score2 === undefined) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores cannot be empty');
    throw new Error('Invalid scores - scores cannot be empty');
  }
  
  if (isNaN(score1) || isNaN(score2)) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores must be numbers');
    throw new Error('Invalid scores - scores must be numbers');
  }
  
  if (score1 < 0 || score2 < 0) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores cannot be negative');
    throw new Error('Invalid scores - scores cannot be negative');
  }
  
  try {
    // Find the exact match by gender + match_number (1-based)
    const matchesRef = collection(db, 'matches');
    const q = query(
      matchesRef,
      where('gender', '==', gender),
      where('match_number', '==', matchIndex + 1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('❌ [SCORE UPDATE] Match not found. gender:', gender, 'match_number:', matchIndex + 1);
      throw new Error(`Match ${matchIndex + 1} (${gender}) not found - scores were NOT saved`);
    }

    const matchId = snapshot.docs[0].id;
    console.log('🎯 [SCORE UPDATE] Updating match ID:', matchId);

    // Update the match
    const matchRef = doc(db, 'matches', matchId);
    await updateDoc(matchRef, {
      score1,
      score2,
      is_completed: true  // Mark as completed
    });

    console.log('✅ [SCORE UPDATE] Match updated successfully');
    console.log(`📊 [SCORE UPDATE] Final score: ${score1} - ${score2}`);
    console.log(`🏆 [SCORE UPDATE] Winner: ${score1 > score2 ? 'Team 1' : score2 > score1 ? 'Team 2' : 'Draw'}`);
    
    // IMPORTANT: Trigger ranking calculation
    // This updates player points based on match result
    console.log('🔄 [SCORE UPDATE] Triggering ranking calculation...');
    const { calculateRankingsFromMatches } = await import('./rankingUtils');
    await calculateRankingsFromMatches();
    console.log('✅ [SCORE UPDATE] Rankings updated!');
    
    return matchId;
  } catch (error) {
    console.error('❌ [SCORE UPDATE] Unexpected error:', error);
    // Rethrow so callers know the scores were NOT saved and can surface the error
    // (previously this silently returned null and callers thought the save worked).
    throw error;
  }
};
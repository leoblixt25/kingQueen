import { db } from '@/config/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';

// Define match combinations (exactly 14 matches)
export const MATCH_COMBINATIONS = [
  [0, 1, 2, 3], [4, 5, 6, 7], [5, 6, 7, 0], [3, 4, 1, 2],
  [6, 3, 4, 1], [0, 2, 7, 5], [2, 4, 3, 7], [1, 6, 5, 0],
  [5, 3, 6, 2], [7, 1, 0, 4], [2, 7, 1, 5], [3, 0, 4, 6],
  [7, 4, 0, 6], [5, 2, 6, 1]
];

export const initializeMatches = async () => {
  console.log('Initializing matches...');
  
  // Get players to create matches
  const playersRef = collection(db, 'players');
  const snapshot = await getDocs(playersRef);
  const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (!players || players.length === 0) {
    console.error('Error fetching players for match initialization');
    return;
  }

  console.log('Players for match initialization:', players);

  const femalePlayers = players.filter((p: any) => p.gender === 'female');
  const malePlayers = players.filter((p: any) => p.gender === 'male');

  console.log('Female players for matches:', femalePlayers.length);
  console.log('Male players for matches:', malePlayers.length);

  if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
    console.error('Incorrect number of players for match creation. Female:', femalePlayers.length, 'Male:', malePlayers.length);
    return;
  }

  // Check if matches already exist to prevent duplicates
  const matchesRef = collection(db, 'matches');
  const matchesSnap = await getDocs(matchesRef);

  if (!matchesSnap.empty) {
    console.log('Matches already exist, skipping initialization');
    return;
  }

  try {
    // Create female matches
    const femaleMatches = MATCH_COMBINATIONS.map((combination, index) => {
      const [p1, p2, p3, p4] = combination;
      return {
        player1_id: femalePlayers[p1].id,
        player2_id: femalePlayers[p2].id,
        player3_id: femalePlayers[p3].id,
        player4_id: femalePlayers[p4].id,
        gender: 'female',
        match_number: index + 1,
        score1: 0,
        score2: 0,
        is_completed: false
      };
    });

    // Insert female matches in parallel
    await Promise.all(femaleMatches.map(match => addDoc(matchesRef, match)));

    // Create male matches
    const maleMatches = MATCH_COMBINATIONS.map((combination, index) => {
      const [p1, p2, p3, p4] = combination;
      return {
        player1_id: malePlayers[p1].id,
        player2_id: malePlayers[p2].id,
        player3_id: malePlayers[p3].id,
        player4_id: malePlayers[p4].id,
        gender: 'male',
        match_number: index + 1,
        score1: 0,
        score2: 0,
        is_completed: false
      };
    });

    // Insert male matches in parallel
    await Promise.all(maleMatches.map(match => addDoc(matchesRef, match)));

    console.log('Matches initialized successfully - 14 female and 14 male matches');
    
  } catch (error) {
    console.error('Error in initializeMatches:', error);
  }
};

export const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female', isEdit: boolean = false) => {
  console.log(`🏐 [SCORE UPDATE] Starting... match=${matchIndex}, scores=${score1}-${score2}, gender=${gender}, isEdit=${isEdit}`);
  
  // VALIDATION: Ensure scores are valid numbers
  if (score1 === null || score1 === undefined || score2 === null || score2 === undefined) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores cannot be empty');
    return null;
  }
  
  if (isNaN(score1) || isNaN(score2)) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores must be numbers');
    return null;
  }
  
  if (score1 < 0 || score2 < 0) {
    console.error('❌ [SCORE UPDATE] Invalid scores - scores cannot be negative');
    return null;
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
      return null;
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
    return null;
  }
};
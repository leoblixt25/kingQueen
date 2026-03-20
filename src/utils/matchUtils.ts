
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
  console.log(`Updating match score: matchIndex=${matchIndex}, score1=${score1}, score2=${score2}, gender=${gender}, isEdit=${isEdit}`);
  
  try {
    // First, get the match to update
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, where('gender', '==', gender));
    const snapshot = await getDocs(q);
    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!matches || matchIndex >= matches.length) {
      console.error('Invalid match index:', matchIndex, 'Total matches:', matches?.length);
      return null;
    }

    const matchId = matches[matchIndex].id;
    console.log('Updating match with ID:', matchId);

    // Update the match - only set is_submitted to true if not editing or if it's a new submission
    const matchRef = doc(db, 'matches', matchId);
    await updateDoc(matchRef, {
      score1,
      score2,
      is_completed: true  // Always set completed when updating scores
    });

    console.log('Match updated successfully');
    return matchId;
  } catch (error) {
    console.error('Unexpected error in updateMatchScore:', error);
    return null;
  }
};

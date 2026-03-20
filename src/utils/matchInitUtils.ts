import { db } from '@/config/firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc } from 'firebase/firestore';
import { STATIC_MATCHUPS, FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize matches using static matchups
 */
export const initializeMatches = async () => {
  console.log('Initializing matches with static matchups...');
  
  try {
    // Check if matches already exist
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    if (!snapshot.empty) {
      console.log('Matches already exist, skipping initialization');
      return;
    }

    // Get players and sort them according to static order
    const playersRef = collection(db, 'players');
    const playersSnapshot = await getDocs(playersRef);
    const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort players according to the static order defined in staticMatchups.ts
    const femalePlayers = FEMALE_PLAYERS.map(name => 
      players.find((p: any) => p.gender === 'female' && p.name === name)
    ).filter(Boolean);
    
    const malePlayers = MALE_PLAYERS.map(name =>
      players.find((p: any) => p.gender === 'male' && p.name === name)
    ).filter(Boolean);

    if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
      throw new Error(`Expected 8 players of each gender, got ${femalePlayers.length} female and ${malePlayers.length} male`);
    }

    // Create female matches
    const femaleMatches = STATIC_MATCHUPS.map((matchup, index) => {
      const [p1, p2, p3, p4] = matchup;
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

    // Create male matches
    const maleMatches = STATIC_MATCHUPS.map((matchup, index) => {
      const [p1, p2, p3, p4] = matchup;
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

    // Insert all matches
    await Promise.all([
      ...femaleMatches.map(match => addDoc(matchesRef, match)),
      ...maleMatches.map(match => addDoc(matchesRef, match))
    ]);

    console.log('Matches initialized successfully');
  } catch (error) {
    console.error('Error in initializeMatches:', error);
    throw error;
  }
};
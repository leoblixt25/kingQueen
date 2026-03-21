import { db } from '@/config/firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc } from 'firebase/firestore';
import { STATIC_MATCHUPS, FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize matches using static matchups
 */
export const initializeMatches = async () => {
  console.log('🚀 [MATCH INIT] Starting match initialization...');
  
  try {
    // Check if matches already exist
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    console.log(`📊 [MATCH INIT] Current matches in database: ${snapshot.size}`);

    if (!snapshot.empty) {
      console.log('✅ [MATCH INIT] Matches already exist, skipping initialization');
      return true; // Indicate success - matches exist
    }

    // Get players and sort them according to static order
    const playersRef = collection(db, 'players');
    const playersSnapshot = await getDocs(playersRef);
    const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📊 [MATCH INIT] Found ${players.length} total players`);

    // Sort players according to the static order defined in staticMatchups.ts
    const femalePlayers = FEMALE_PLAYERS.map(name => 
      players.find((p: any) => p.gender === 'female' && p.name === name)
    ).filter(Boolean);
    
    const malePlayers = MALE_PLAYERS.map(name =>
      players.find((p: any) => p.gender === 'male' && p.name === name)
    ).filter(Boolean);

    console.log(`📊 [MATCH INIT] Female players matched: ${femalePlayers.length}`);
    console.log(`📊 [MATCH INIT] Male players matched: ${malePlayers.length}`);

    if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
      const errorMsg = `Expected 8 players of each gender, got ${femalePlayers.length} female and ${malePlayers.length} male`;
      console.error('❌ [MATCH INIT] ' + errorMsg);
      throw new Error(errorMsg);
    }

    // Create female matches (14 matches)
    console.log('➕ [MATCH INIT] Creating 14 female matches...');
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

    console.log('📝 [MATCH INIT] Inserting female matches...');
    const femaleResults = await Promise.all(
      femaleMatches.map(match => addDoc(matchesRef, match))
    );
    console.log(`✅ [MATCH INIT] Created ${femaleResults.length} female matches`);

    // Create male matches (14 matches)
    console.log('➕ [MATCH INIT] Creating 14 male matches...');
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

    console.log('📝 [MATCH INIT] Inserting male matches...');
    const maleResults = await Promise.all(
      maleMatches.map(match => addDoc(matchesRef, match))
    );
    console.log(`✅ [MATCH INIT] Created ${maleResults.length} male matches`);

    const totalCreated = femaleResults.length + maleResults.length;
    console.log(`🎉 [MATCH INIT] Matches initialized successfully: ${totalCreated} total (${femaleResults.length} female, ${maleResults.length} male)`);
    
    return true; // Indicate success
  } catch (error) {
    console.error('❌ [MATCH INIT] Failed to initialize matches:', error);
    throw error;
  }
};
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { STATIC_MATCHUPS, FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize matches using DETERMINISTIC IDs
 * Runs ONLY ONCE - checks if matches already exist
 * Prevents duplicate generation on reload
 */
export const initializeMatches = async () => {
  console.log('🚀 [MATCH INIT] Starting match initialization...');
  
  try {
    // Check if matches already exist
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    console.log(`📊 [MATCH INIT] Current matches in database: ${snapshot.size}`);

    // If ANY matches exist, skip initialization (prevents duplicates)
    if (!snapshot.empty) {
      console.log('✅ [MATCH INIT] Matches already exist - SKIPPING INITIALIZATION');
      return true;
    }

    console.log('➕ [MATCH INIT] Creating matches with deterministic IDs...');

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

    // Create female matches with DETERMINISTIC IDs: female_match_1 to female_match_14
    console.log('➕ [MATCH INIT] Creating 14 female matches...');
    for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
      const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
      const matchId = `female_match_${i + 1}`;
      const matchData = {
        player1_id: femalePlayers[p1].id,
        player2_id: femalePlayers[p2].id,
        player3_id: femalePlayers[p3].id,
        player4_id: femalePlayers[p4].id,
        gender: 'female',
        match_number: i + 1,
        score1: 0,
        score2: 0,
        is_completed: false,
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(matchesRef, matchId), matchData);
      console.log(`✅ [MATCH INIT] Created ${matchId}`);
    }
    console.log('✅ [MATCH INIT] Created 14 female matches');

    // Create male matches with DETERMINISTIC IDs: male_match_1 to male_match_14
    console.log('➕ [MATCH INIT] Creating 14 male matches...');
    for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
      const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
      const matchId = `male_match_${i + 1}`;
      const matchData = {
        player1_id: malePlayers[p1].id,
        player2_id: malePlayers[p2].id,
        player3_id: malePlayers[p3].id,
        player4_id: malePlayers[p4].id,
        gender: 'male',
        match_number: i + 1,
        score1: 0,
        score2: 0,
        is_completed: false,
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(matchesRef, matchId), matchData);
      console.log(`✅ [MATCH INIT] Created ${matchId}`);
    }
    console.log('✅ [MATCH INIT] Created 14 male matches');

    console.log('🎉 [MATCH INIT] Matches initialized successfully with deterministic IDs!');
    console.log('📊 [MATCH INIT] Total: 28 matches (14 female + 14 male)');
    
    return true;
  } catch (error) {
    console.error('❌ [MATCH INIT] Failed to initialize matches:', error);
    throw error;
  }
};
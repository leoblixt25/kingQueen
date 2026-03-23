import { db } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { FEMALE_PLAYERS, MALE_PLAYERS, STATIC_MATCHUPS } from './staticMatchups';

/**
 * MIGRATION-SAFE INITIALIZATION
 * Works with existing auto-generated IDs OR creates deterministic ones
 * 
 * CRITICAL: This checks if we have 8+ players per gender FIRST
 * If yes → does nothing (works with existing data)
 * If no → deletes ALL and recreates with deterministic IDs
 */
export const initializePlayersSafe = async () => {
  console.log('🚀 [MIGRATION] Starting safe player initialization...');
  
  try {
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    // Count by gender
    const femaleCount = snapshot.docs.filter(doc => doc.data().gender === 'female').length;
    const maleCount = snapshot.docs.filter(doc => doc.data().gender === 'male').length;
    
    console.log(`📊 [MIGRATION] Current - Female: ${femaleCount}, Male: ${maleCount}`);
    
    // ✅ STRICT LIMIT: MUST BE EXACTLY 8 OF EACH GENDER
    if (femaleCount === 8 && maleCount === 8) {
      console.log('✅ [MIGRATION] Already have EXACTLY 8 players per gender - using existing data');
      console.log('💡 [MIGRATION] No changes needed - app will work with current players');
      return true;
    }
    
    // ❌ IF MORE OR LESS THAN 8 → CLEAR AND RECREATE
    if (femaleCount !== 8 || maleCount !== 8) {
      console.log(`⚠️ [MIGRATION] Incorrect player count! Expected 8F+8M, got ${femaleCount}F+${maleCount}M`);
      console.log('🗑️ [MIGRATION] Clearing all and recreating with exactly 8 per gender...');
      await deleteAllPlayers();
    }
    
    // ➕ CREATE FRESH WITH DETERMINISTIC IDS
    console.log('➕ [MIGRATION] Creating EXACTLY 16 players with deterministic IDs...');
    await createDefaultPlayers();
    
    console.log('🎉 [MIGRATION] Players initialized successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ [MIGRATION] Failed:', error);
    throw error;
  }
};

/**
 * Delete all players (cleanup for migration)
 */
const deleteAllPlayers = async () => {
  const playersRef = collection(db, 'players');
  const snapshot = await getDocs(playersRef);
  
  console.log(`🗑️ [MIGRATION] Deleting ${snapshot.size} players...`);
  
  let batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    
    if (count % 500 === 0) {
      batch.commit();
      batch = writeBatch(db);
    }
  });
  
  await batch.commit();
  console.log(`✅ [MIGRATION] Deleted ${count} players`);
};

/**
 * Create default players with deterministic IDs
 */
const createDefaultPlayers = async () => {
  const playersRef = collection(db, 'players');
  
  // Create female players: female_1 to female_8
  for (let i = 0; i < FEMALE_PLAYERS.length; i++) {
    const playerId = `female_${i + 1}`;
    await setDoc(doc(playersRef, playerId), {
      name: FEMALE_PLAYERS[i],
      gender: 'female',
      points: 0,
      total_scores: 0,
      position: i + 1,
      is_confirmed: false,
      created_at: new Date().toISOString()
    });
    console.log(`✅ [MIGRATION] Created ${playerId}: ${FEMALE_PLAYERS[i]}`);
  }
  
  // Create male players: male_1 to male_8
  for (let i = 0; i < MALE_PLAYERS.length; i++) {
    const playerId = `male_${i + 1}`;
    await setDoc(doc(playersRef, playerId), {
      name: MALE_PLAYERS[i],
      gender: 'male',
      points: 0,
      total_scores: 0,
      position: i + 1,
      is_confirmed: false,
      created_at: new Date().toISOString()
    });
    console.log(`✅ [MIGRATION] Created ${playerId}: ${MALE_PLAYERS[i]}`);
  }
};

/**
 * Migration-safe match initialization
 */
export const initializeMatchesSafe = async () => {
  console.log('🚀 [MIGRATION] Starting safe match initialization...');
  
  try {
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    console.log(`📊 [MIGRATION] Current matches: ${snapshot.size}`);
    
    // ✅ IF ANY MATCHES EXIST → USE THEM
    if (!snapshot.empty) {
      console.log('✅ [MIGRATION] Matches already exist - using existing data');
      return true;
    }
    
    // ➕ CREATE FRESH MATCHES
    console.log('➕ [MIGRATION] Creating matches...');
    await createMatches();
    
    console.log('🎉 [MIGRATION] Matches initialized successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ [MIGRATION] Failed:', error);
    throw error;
  }
};

/**
 * Create matches (assumes players exist)
 */
const createMatches = async () => {
  const matchesRef = collection(db, 'matches');
  
  // Get players - handle both old and new ID formats
  const playersSnapshot = await getDocs(collection(db, 'players'));
  const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const femalePlayers = players.filter((p: any) => p.gender === 'female');
  const malePlayers = players.filter((p: any) => p.gender === 'male');
  
  console.log(`📊 [MIGRATION] Found ${femalePlayers.length} female, ${malePlayers.length} male players`);
  
  if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
    throw new Error(`Expected 8 players each, got ${femalePlayers.length}F and ${malePlayers.length}M`);
  }
  
  // Create female matches
  for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
    const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
    const matchId = `female_match_${i + 1}`;
    
    await setDoc(doc(matchesRef, matchId), {
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
    });
  }
  
  // Create male matches
  for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
    const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
    const matchId = `male_match_${i + 1}`;
    
    await setDoc(doc(matchesRef, matchId), {
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
    });
  }
  
  console.log('✅ [MIGRATION] Created 28 matches (14F + 14M)');
};

import { db } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { FEMALE_PLAYERS, MALE_PLAYERS, STATIC_MATCHUPS } from './staticMatchups';

/**
 * COMPLETE TOURNAMENT RESET
 * Deletes ALL data and recreates fresh default state
 * 
 * Process:
 * 1. Delete all players
 * 2. Delete all matches
 * 3. Create exactly 8 players per gender with deterministic IDs
 * 4. Generate round-robin matches
 */
export const resetTournament = async () => {
  console.log('🔄 [RESET] Starting COMPLETE tournament reset...');
  
  try {
    // ========== STEP 1: DELETE ALL PLAYERS ==========
    console.log('🗑️ [RESET] Deleting ALL players...');
    await deleteAllPlayers();
    console.log('✅ [RESET] All players deleted');
    
    // ========== STEP 2: DELETE ALL MATCHES ==========
    console.log('🗑️ [RESET] Deleting ALL matches...');
    await deleteAllMatches();
    console.log('✅ [RESET] All matches deleted');
    
    // ========== STEP 3: CREATE DEFAULT PLAYERS ==========
    console.log('➕ [RESET] Creating EXACTLY 16 default players...');
    await createDefaultPlayers();
    console.log('✅ [RESET] Default players created');
    
    // ========== STEP 4: GENERATE MATCHES ==========
    console.log('🏐 [RESET] Generating round-robin matches...');
    await generateMatches();
    console.log('✅ [RESET] Matches generated');
    
    console.log('🎉 [RESET] ========================================');
    console.log('🎉 [RESET] TOURNAMENT RESET COMPLETE!');
    console.log('🎉 [RESET] - 16 players (8F + 8M)');
    console.log('🎉 [RESET] - 28 matches (14F + 14M)');
    console.log('🎉 [RESET] - All scores reset to 0');
    console.log('🎉 [RESET] ========================================');
    
    return true;
  } catch (error) {
    console.error('❌ [RESET] Tournament reset FAILED:', error);
    throw error;
  }
};

/**
 * Delete ALL players from Firestore
 * Uses batch deletion for efficiency
 */
const deleteAllPlayers = async () => {
  try {
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    console.log(`📊 [RESET] Found ${snapshot.size} players to delete`);
    
    if (snapshot.empty) {
      console.log('ℹ️ [RESET] No players to delete');
      return;
    }
    
    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach((doc, index) => {
      batch.delete(doc.ref);
      count++;
      
      // Commit batch every 500 docs
      if (count % batchSize === 0) {
        batch.commit();
        batch = writeBatch(db);
        console.log(`🗑️ [RESET] Deleted ${count} players...`);
      }
    });
    
    // Commit remaining
    if (count % batchSize !== 0) {
      await batch.commit();
    }
    
    console.log(`✅ [RESET] Deleted ${count} players total`);
  } catch (error) {
    console.error('❌ [RESET] Error deleting players:', error);
    throw error;
  }
};

/**
 * Delete ALL matches from Firestore
 */
const deleteAllMatches = async () => {
  try {
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    console.log(`📊 [RESET] Found ${snapshot.size} matches to delete`);
    
    if (snapshot.empty) {
      console.log('ℹ️ [RESET] No matches to delete');
      return;
    }
    
    // Delete in batches
    const batchSize = 500;
    let batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach((doc, index) => {
      batch.delete(doc.ref);
      count++;
      
      if (count % batchSize === 0) {
        batch.commit();
        batch = writeBatch(db);
        console.log(`🗑️ [RESET] Deleted ${count} matches...`);
      }
    });
    
    if (count % batchSize !== 0) {
      await batch.commit();
    }
    
    console.log(`✅ [RESET] Deleted ${count} matches total`);
  } catch (error) {
    console.error('❌ [RESET] Error deleting matches:', error);
    throw error;
  }
};

/**
 * Create EXACTLY 8 players per gender with DETERMINISTIC IDs
 * Uses setDoc to prevent duplicates
 */
const createDefaultPlayers = async () => {
  const playersRef = collection(db, 'players');
  
  try {
    // Create female players: female_1 to female_8
    console.log('👥 [RESET] Creating 8 female players with deterministic IDs...');
    for (let i = 0; i < FEMALE_PLAYERS.length; i++) {
      const playerId = `female_${i + 1}`;
      const playerData = {
        name: FEMALE_PLAYERS[i],
        gender: 'female',
        points: 0,
        total_scores: 0,
        position: i + 1,
        is_confirmed: false,
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(playersRef, playerId), playerData);
      console.log(`✅ [RESET] Created ${playerId}: ${FEMALE_PLAYERS[i]}`);
    }
    
    // Create male players: male_1 to male_8
    console.log('👥 [RESET] Creating 8 male players with deterministic IDs...');
    for (let i = 0; i < MALE_PLAYERS.length; i++) {
      const playerId = `male_${i + 1}`;
      const playerData = {
        name: MALE_PLAYERS[i],
        gender: 'male',
        points: 0,
        total_scores: 0,
        position: i + 1,
        is_confirmed: false,
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(playersRef, playerId), playerData);
      console.log(`✅ [RESET] Created ${playerId}: ${MALE_PLAYERS[i]}`);
    }
    
    console.log('🎉 [RESET] Created 16 players total (8F + 8M)');
  } catch (error) {
    console.error('❌ [RESET] Error creating players:', error);
    throw error;
  }
};

/**
 * Generate round-robin matches for both genders
 * Each player plays with every other player exactly once
 */
const generateMatches = async () => {
  const matchesRef = collection(db, 'matches');
  
  try {
    // Get all players
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Separate by gender
    const femalePlayers = players.filter((p: any) => p.gender === 'female');
    const malePlayers = players.filter((p: any) => p.gender === 'male');
    
    console.log(`📊 [RESET] Found ${femalePlayers.length} female, ${malePlayers.length} male players`);
    
    if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
      throw new Error(`Expected 8 players each, got ${femalePlayers.length}F and ${malePlayers.length}M`);
    }
    
    // Create female matches using STATIC_MATCHUPS
    console.log('🏐 [RESET] Creating 14 female matches...');
    for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
      const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
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
      
      await setDoc(doc(matchesRef, `female_match_${i + 1}`), matchData);
    }
    console.log('✅ [RESET] Created 14 female matches');
    
    // Create male matches using STATIC_MATCHUPS
    console.log('🏐 [RESET] Creating 14 male matches...');
    for (let i = 0; i < STATIC_MATCHUPS.length; i++) {
      const [p1, p2, p3, p4] = STATIC_MATCHUPS[i];
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
      
      await setDoc(doc(matchesRef, `male_match_${i + 1}`), matchData);
    }
    console.log('✅ [RESET] Created 14 male matches');
    
    console.log('🎉 [RESET] Generated 28 matches total (14F + 14M)');
  } catch (error) {
    console.error('❌ [RESET] Error generating matches:', error);
    throw error;
  }
};

/**
 * Quick helper to check current state
 */
export const checkTournamentState = async () => {
  try {
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const matchesSnapshot = await getDocs(collection(db, 'matches'));
    
    const femaleCount = playersSnapshot.docs.filter(d => d.data().gender === 'female').length;
    const maleCount = playersSnapshot.docs.filter(d => d.data().gender === 'male').length;
    
    console.log('📊 [STATE CHECK]');
    console.log(`  Players: ${playersSnapshot.size} total (${femaleCount}F, ${maleCount}M)`);
    console.log(`  Matches: ${matchesSnapshot.size} total`);
    
    return {
      players: playersSnapshot.size,
      matches: matchesSnapshot.size,
      femalePlayers: femaleCount,
      malePlayers: maleCount
    };
  } catch (error) {
    console.error('❌ [STATE CHECK] Failed:', error);
    return null;
  }
};

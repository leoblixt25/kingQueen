import { db } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, query, where, updateDoc } from 'firebase/firestore';
import { FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize players using DETERMINISTIC IDs
 * CRITICAL: Uses setDoc with fixed IDs to prevent duplicates
 * Enforces HARD LIMIT of exactly 8 players per gender
 */
export const initializePlayers = async () => {
  console.log('🚀 [INIT] Starting player initialization...');
  
  try {
    const playersRef = collection(db, 'players');
    
    // Check existing players by gender
    const snapshot = await getDocs(playersRef);
    const femaleCount = snapshot.docs.filter(doc => doc.data().gender === 'female').length;
    const maleCount = snapshot.docs.filter(doc => doc.data().gender === 'male').length;
    
    console.log(`📊 [INIT] Current - Female: ${femaleCount}, Male: ${maleCount}`);
    
    // HARD LIMIT: If we have 8+ of each gender, DO NOTHING
    if (femaleCount >= 8 && maleCount >= 8) {
      console.log('✅ [INIT] Already have 8+ players per gender - SKIPPING INITIALIZATION');
      return true;
    }
    
    // If some players exist but not 8, don't mix placeholders with real players
    if (femaleCount > 0 || maleCount > 0) {
      console.log('⚠️ [INIT] Some real players exist - NOT creating placeholders');
      console.log('💡 [INIT] Admin should manually manage players if needed');
      return true;
    }
    
    console.log('➕ [INIT] Creating EXACTLY 16 players with deterministic IDs...');
    
    // Create female players with FIXED IDs: female_1 to female_8
    console.log('👥 [INIT] Creating 8 female players...');
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
      
      // Use setDoc with fixed ID - prevents duplicates!
      await setDoc(doc(playersRef, playerId), playerData);
      console.log(`✅ [INIT] Created ${playerId}: ${FEMALE_PLAYERS[i]}`);
    }
    
    // Create male players with FIXED IDs: male_1 to male_8
    console.log('👥 [INIT] Creating 8 male players...');
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
      console.log(`✅ [INIT] Created ${playerId}: ${MALE_PLAYERS[i]}`);
    }
    
    console.log('🎉 [INIT] Players initialized successfully with deterministic IDs!');
    console.log('📊 [INIT] Total: 16 players (8 female + 8 male)');
    
    return true;
  } catch (error) {
    console.error('❌ [INIT] Failed to initialize players:', error);
    throw error;
  }
};

/**
 * Replace a single player name without affecting match structure
 */
export const replacePlayerName = async (oldName: string, newName: string, gender: 'male' | 'female') => {
  console.log(`Replacing player: ${oldName} -> ${newName} (${gender})`);
  
  try {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where('name', '==', oldName), where('gender', '==', gender));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('Player not found:', oldName, gender);
      throw new Error('Player not found');
    }

    const playerDoc = snapshot.docs[0];
    await updateDoc(doc(db, 'players', playerDoc.id), { name: newName });

    console.log('Player name replaced successfully');
  } catch (error) {
    console.error('Error in replacePlayerName:', error);
    throw error;
  }
};
import { db } from '@/config/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize players using static names
 */
export const initializePlayers = async () => {
  console.log('🚀 [INIT] Starting player initialization...');
  
  try {
    // Check if players already exist
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);

    console.log(`📊 [INIT] Current players in database: ${snapshot.size}`);

    if (!snapshot.empty) {
      console.log('✅ [INIT] Players already exist, skipping initialization');
      return true; // Indicate success - players exist
    }

    console.log('➕ [INIT] Creating 16 new placeholder players (8 male, 8 female)...');

    // Insert female players as placeholders
    const femaleInserts = FEMALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'female',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
    }));

    console.log('📝 [INIT] Inserting female players...');
    const femaleResults = await Promise.all(
      femaleInserts.map(player => addDoc(playersRef, player))
    );
    console.log(`✅ [INIT] Created ${femaleResults.length} female players`);

    // Insert male players as placeholders
    const maleInserts = MALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'male',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
    }));

    console.log('📝 [INIT] Inserting male players...');
    const maleResults = await Promise.all(
      maleInserts.map(player => addDoc(playersRef, player))
    );
    console.log(`✅ [INIT] Created ${maleResults.length} male players`);

    const totalCreated = femaleResults.length + maleResults.length;
    console.log(`🎉 [INIT] Players initialized successfully: ${totalCreated} total (${femaleResults.length} female, ${maleResults.length} male)`);
    
    return true; // Indicate success
  } catch (error) {
    console.error('❌ [INIT] Failed to initialize players:', error);
    throw error; // Re-throw to let caller handle
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
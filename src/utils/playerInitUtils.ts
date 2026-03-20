import { db } from '@/config/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { FEMALE_PLAYERS, MALE_PLAYERS } from './staticMatchups';

/**
 * Initialize players using static names
 */
export const initializePlayers = async () => {
  console.log('Initializing players with static names...');
  
  try {
    // Check if players already exist
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);

    if (!snapshot.empty) {
      console.log('Players already exist, skipping initialization');
      return;
    }

    // Insert female players as placeholders
    const femaleInserts = FEMALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'female',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
    }));

    await Promise.all(femaleInserts.map(player => addDoc(playersRef, player)));

    // Insert male players as placeholders
    const maleInserts = MALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'male',
      points: 0,
      total_scores: 0,
      position: index + 1,
      is_confirmed: false
    }));

    await Promise.all(maleInserts.map(player => addDoc(playersRef, player)));

    console.log('Players initialized successfully');
  } catch (error) {
    console.error('Error in initializePlayers:', error);
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
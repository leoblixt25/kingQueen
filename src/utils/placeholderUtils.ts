import { db } from '@/config/firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, deleteDoc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';

/**
 * Reset all players to placeholder names and unconfirmed status
 * This will prepare the database for the new registration system
 */
export const resetPlayersToPlaceholders = async () => {
  console.log('Resetting players to placeholder names...');
  
  try {
    // Create female placeholder players
    const placeholderPlayers = [];
    for (let i = 1; i <= 8; i++) {
      placeholderPlayers.push({
        name: `Female Player ${i}`,
        gender: 'female',
        position: i,
        points: 0,
        total_scores: 0,
        matches_played: 0,
        is_confirmed: false,
        email: null,
        registered_at: null
      });
    }
    
    // Create male placeholder players
    for (let i = 1; i <= 8; i++) {
      placeholderPlayers.push({
        name: `Male Player ${i}`,
        gender: 'male',
        position: i,
        points: 0,
        total_scores: 0,
        matches_played: 0,
        is_confirmed: false,
        email: null,
        registered_at: null
      });
    }

    // Delete all existing players using batch operations
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();

    // Insert new placeholder players
    await Promise.all(placeholderPlayers.map(player => addDoc(playersRef, player)));

    console.log('✅ Successfully reset players to placeholders');
    return true;

  } catch (error) {
    console.error('❌ Error resetting players to placeholders:', error);
    throw error;
  }
};

/**
 * Get the next available placeholder slot for a gender
 */
export const getNextAvailablePlaceholder = async (gender: 'male' | 'female') => {
  try {
    console.log(`🔍 Looking for available ${gender} slots...`);
    
    const playersRef = collection(db, 'players');
    
    // First, get all players of this gender
    const q = query(
      playersRef,
      where('gender', '==', gender)
    );
    
    const snapshot = await getDocs(q);
    
    // Filter for unconfirmed placeholders client-side
    const placeholderPrefix = gender === 'male' ? 'Male Player' : 'Female Player';
    const availableSlots = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((player: any) => {
        // Check if it's a placeholder name and is unconfirmed
        const isPlaceholder = player.name.startsWith(placeholderPrefix);
        const isUnconfirmed = !player.is_confirmed || player.is_confirmed === false;
        return isPlaceholder && isUnconfirmed;
      })
      .sort((a: any, b: any) => a.position - b.position);

    console.log(`📊 Found ${availableSlots.length} available ${gender} slots`);

    if (availableSlots.length === 0) {
      console.log(`❌ No available ${gender} slots`);
      return null;
    }

    const firstSlot = availableSlots[0];
    console.log(`✅ Available slot found: Position ${firstSlot.position}`);
    return firstSlot;
  } catch (error) {
    console.error('Error in getNextAvailablePlaceholder:', error);
    throw error;
  }
};

/**
 * Register a player by replacing a placeholder
 */
export const registerPlayerToSlot = async (
  name: string, 
  email: string, 
  gender: 'male' | 'female'
) => {
  try {
    // Check if email already exists
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Find next available placeholder
    const placeholder = await getNextAvailablePlaceholder(gender);
    
    if (!placeholder) {
      throw new Error('NO_SLOTS_AVAILABLE');
    }

    // Update the placeholder with real player info
    const playerRef = doc(db, 'players', placeholder.id);
    await updateDoc(playerRef, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      is_confirmed: true,
      registered_at: new Date().toISOString()
    });

    console.log(`✅ Successfully registered ${name} to position ${(placeholder as any).position}`);
    return {
      success: true,
      position: (placeholder as any).position,
      playerId: placeholder.id
    };

  } catch (error) {
    console.error('Error in registerPlayerToSlot:', error);
    throw error;
  }
};

/**
 * Unregister a player by converting back to placeholder
 */
export const unregisterPlayer = async (email: string) => {
  try {
    // Find the confirmed player
    const playersRef = collection(db, 'players');
    const q = query(
      playersRef,
      where('email', '==', email.toLowerCase()),
      where('is_confirmed', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('PLAYER_NOT_FOUND');
    }

    const playerDoc = snapshot.docs[0];
    const player = { id: playerDoc.id, ...playerDoc.data() } as any;

    // Convert back to placeholder
    const placeholderName = player.gender === 'male' 
      ? `Male Player ${player.position}` 
      : `Female Player ${player.position}`;

    const playerRef = doc(db, 'players', player.id);
    await updateDoc(playerRef, {
      name: placeholderName,
      email: null,
      is_confirmed: false,
      registered_at: null,
      points: 0,
      total_scores: 0,
      matches_played: 0
    });

    console.log(`✅ Successfully unregistered ${player.name} from position ${player.position}`);
    return true;

  } catch (error) {
    console.error('Error in unregisterPlayer:', error);
    throw error;
  }
};
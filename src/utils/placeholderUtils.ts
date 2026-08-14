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
        status: null,
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
        status: null,
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
    console.log(`🔍 STEP 1: getNextAvailablePlaceholder('${gender}') called`);
    
    const playersRef = collection(db, 'players');
    
    // Get ALL players of this gender first
    const q = query(
      playersRef,
      where('gender', '==', gender)
    );
    
    console.log('📊 Firestore query: SELECT * FROM players WHERE gender ==', gender);
    const snapshot = await getDocs(q);
    
    console.log('📊 Total players in database for', gender + ':', snapshot.size);
    
    // Log all players to see what's in the database
    const allPlayers = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      is_confirmed: doc.data().is_confirmed,
      position: doc.data().position,
      email: doc.data().email
    }));
    
    console.log('📋 All', gender, 'players:', JSON.stringify(allPlayers, null, 2));
    
    // Filter for unconfirmed placeholders client-side
    const placeholderPrefix = gender === 'male' ? 'Male Player' : 'Female Player';
    const availableSlots = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter((player: any) => {
        const isPlaceholder = player.name.startsWith(placeholderPrefix);
        const isUnconfirmed = !player.is_confirmed || player.is_confirmed === false;
        if (isPlaceholder && isUnconfirmed) {
          console.log('✅ Found available slot:', player.name, 'at position', player.position);
        }
        return isPlaceholder && isUnconfirmed;
      })
      .sort((a: any, b: any) => a.position - b.position);

    console.log(`📊 Available slots count:`, availableSlots.length);

    if (availableSlots.length === 0) {
      console.log(`❌ NO SLOTS AVAILABLE for ${gender}`);
      console.log('💡 This means all 8 positions are confirmed/registered');
      return null;
    }

    const firstSlot = availableSlots[0];
    console.log(`✅ SLOT FOUND: Position ${firstSlot.position}, ID: ${firstSlot.id}`);
    return firstSlot;
  } catch (error) {
    console.error('❌ getNextAvailablePlaceholder() FAILED:', error);
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
      is_confirmed: false,
      status: 'pending',
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
export const unregisterPlayer = async (email: string) => {  try {
    // Find the confirmed player
    const playersRef = collection(db, 'players');
    const q = query(
      playersRef,
      where('email', '==', email.toLowerCase()),
      where('status', '==', 'approved')
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
      status: null,
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

/**
 * Remove a pending player, freeing their slot back to a placeholder
 * Handles both pending (slot-taking) and reserve (no slot) players
 */
export const removePendingPlayer = async (player: any) => {
  try {
    const playerRef = doc(db, 'players', player.id);

    // Reserve players were added as extra docs (no placeholder slot) - just delete
    if (player.is_reserve === true) {
      await deleteDoc(playerRef);
      console.log(`✅ Successfully removed reserve player ${player.name}`);
      return true;
    }

    // Pending player occupies a placeholder slot - convert back to placeholder
    const placeholderName = player.gender === 'male'
      ? `Male Player ${player.position}`
      : `Female Player ${player.position}`;

    await updateDoc(playerRef, {
      name: placeholderName,
      email: null,
      is_confirmed: false,
      status: null,
      registered_at: null,
      points: 0,
      total_scores: 0,
      matches_played: 0
    });

    console.log(`✅ Successfully removed pending player ${player.name}, slot freed`);
    return true;

  } catch (error) {
    console.error('Error in removePendingPlayer:', error);
    throw error;
  }
};
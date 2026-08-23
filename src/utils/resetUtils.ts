import { db } from '@/config/firebase';
import { auth } from '@/config/firebase';
import { collection, getDocs, writeBatch, doc, query } from 'firebase/firestore';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches } from './matchInitUtils';
import { getCurrentUser } from '@/utils/authUtils';

/**
 * Reset scores only - keeps players and match structure
 */
export const resetScoresOnly = async () => {
  console.log('Resetting scores only...');
  
  try {
    const batch = writeBatch(db);
    
    // Reset all player points and total scores
    const playersRef = collection(db, 'players');
    const playersSnap = await getDocs(playersRef);
    playersSnap.docs.forEach(playerDoc => {
      batch.update(playerDoc.ref, { points: 0, total_scores: 0 });
    });
    
    // Reset all match scores
    const matchesRef = collection(db, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    matchesSnap.docs.forEach(matchDoc => {
      batch.update(matchDoc.ref, { score1: 0, score2: 0, is_completed: false });
    });
    
    // Delete final match
    const finalMatchesRef = collection(db, 'finalMatches');
    const finalMatchesSnap = await getDocs(finalMatchesRef);
    finalMatchesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    console.log('Scores reset successfully');
  } catch (error) {
    console.error('Error in resetScoresOnly:', error);
    throw error;
  }
};

/**
 * Delete Firebase Authentication users via Cloudflare Worker (FREE - No Blaze Plan Required)
 */
export const deleteFirebaseAuthUsers = async () => {
  console.log('🗑️ [AUTH] Deleting Firebase Authentication users...');
  
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Get the Firebase ID token
    const token = await user.getIdToken();
    
    // Call Cloudflare Worker endpoint
    // IMPORTANT: Update this URL after deploying the worker to Cloudflare
    const workerUrl = 'https://sandy-scorekeeper-workers.leo-blixt77.workers.dev';
    
    console.log('🌐 [AUTH] Calling Cloudflare Worker to delete users...');
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete Firebase users');
    }

    console.log(`✅ [AUTH] Successfully deleted ${result.deletedCount} users`);
    return result;
  } catch (error) {
    console.error('❌ [AUTH] Error deleting Firebase Authentication users:', error);
    throw error;
  }
};

/**
 * Complete tournament reset - deletes everything and reinitializes
 */
export const fullTournamentReset = async () => {
  console.log('Performing full tournament reset...');
  
  try {
    // Step 1: Delete Firebase Authentication users (via Cloudflare Worker - FREE)
    console.log('🗑️ [RESET] Step 1: Deleting Firebase Auth users via Cloudflare Worker...');
    try {
      const result = await deleteFirebaseAuthUsers();
      console.log('✅ [RESET] Auth users deleted:', result);
    } catch (authError) {
      console.error('⚠️ [RESET] Auth user deletion failed, continuing with Firestore reset:', authError);
      // Continue with Firestore reset even if auth deletion fails
    }
    
    // Step 2: Delete everything using batch operations
    const batch = writeBatch(db);
    
    // Delete final matches
    const finalMatchesRef = collection(db, 'finalMatches');
    const finalMatchesSnap = await getDocs(finalMatchesRef);
    finalMatchesSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete matches
    const matchesRef = collection(db, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    matchesSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete players
    const playersRef = collection(db, 'players');
    const playersSnap = await getDocs(playersRef);
    playersSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log('🗑️ [RESET] All data deleted');
    
    // Reinitialize players first
    await initializePlayers();
    console.log('✅ [RESET] Players initialized');
    
    // Brief pause for player creation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then initialize matches
    await initializeMatches();
    console.log('✅ [RESET] Matches initialized');
    
    // Additional pause to ensure all writes are committed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ [RESET] Full tournament reset completed successfully');
  } catch (error) {
    console.error('❌ [RESET] Error in fullTournamentReset:', error);
    throw error;
  }
};
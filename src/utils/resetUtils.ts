import { db } from '@/config/firebase';
import { auth } from '@/config/firebase';
import { collection, getDocs, writeBatch, doc, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches } from './matchInitUtils';

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
 * Delete Firebase Authentication users via Firebase Cloud Function
 */
export const deleteFirebaseAuthUsers = async () => {
  console.log('🗑️ [AUTH] Deleting Firebase Authentication users...');
  
  try {
    // Get Firebase Functions instance
    const functions = getFunctions();
    
    // Get the callable function
    const resetEverythingFn = httpsCallable(functions, 'resetEverything');
    
    console.log('🌐 [AUTH] Calling Firebase Cloud Function to delete users...');
    
    // Call the cloud function with confirmation flag
    const result: any = await resetEverythingFn({ confirm: true });
    
    console.log(`✅ [AUTH] Cloud function result:`, result.data);
    return result.data;
  } catch (error: any) {
    console.error('❌ [AUTH] Error calling Firebase Cloud Function:', error);
    
    // Provide more specific error messages
    if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to perform this action.');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('Only the admin can perform this action.');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Confirmation flag must be set to true.');
    }
    
    throw error;
  }
};

/**
 * Complete tournament reset - deletes everything and reinitializes
 */
export const fullTournamentReset = async () => {
  console.log('Performing full tournament reset...');
  
  try {
    // Step 1: Delete Firebase Authentication users and Firestore data (via Firebase Cloud Function)
    console.log('🗑️ [RESET] Step 1: Calling Firebase Cloud Function to reset everything...');
    try {
      const result = await deleteFirebaseAuthUsers();
      console.log('✅ [RESET] Cloud function completed:', result);
    } catch (authError) {
      console.error('⚠️ [RESET] Cloud function failed, continuing with local Firestore reset:', authError);
      // Continue with Firestore reset even if cloud function fails
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
import { db } from '@/config/firebase';
import { collection, getDocs, writeBatch, doc, query } from 'firebase/firestore';
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
 * Complete tournament reset - deletes everything and reinitializes
 */
export const fullTournamentReset = async () => {
  console.log('Performing full tournament reset...');
  
  try {
    // Delete everything using batch operations
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
    
    // Reinitialize players first
    await initializePlayers();
    
    // Brief pause for player creation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then initialize matches
    await initializeMatches();
    
    console.log('Full tournament reset completed');
  } catch (error) {
    console.error('Error in fullTournamentReset:', error);
    throw error;
  }
};
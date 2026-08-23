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
 * Wait for the "Delete registered players" GitHub Action run to finish.
 * Status is polled through the Cloudflare Worker (the repo is private, so
 * the browser cannot query the GitHub API anonymously).
 */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitForGithubRunCompletion(workerUrl: string, startedAtIso: string): Promise<string> {
  // Poll every 5s for up to 4 minutes
  for (let i = 0; i < 48; i++) {
    await sleep(5000);
    try {
      const resp = await fetch(
        `${workerUrl}/status?since=${encodeURIComponent(startedAtIso)}`
      );
      if (!resp.ok) continue;

      const data = await resp.json();
      if (data.status === 'none' || data.status === 'error') continue;

      console.log(`⏳ [AUTH] GitHub Action status: ${data.status}`);
      if (data.status === 'completed') return data.conclusion;
    } catch {
      // transient network hiccup — keep polling
    }
  }
  throw new Error('Timed out waiting for the deletion to finish (check the repo Actions tab)');
}

/**
 * Delete Firebase Authentication users:
 * Cloudflare Worker verifies the admin, then triggers a GitHub Action which
 * performs the deletion (GitHub has no CPU limits on the free plan).
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
    
    const workerUrl = 'https://sandy-scorekeeper-workers.leo-blixt77.workers.dev';
    
    // Allow matching a run created slightly before our dispatch (clock skew)
    const startedAtIso = new Date(Date.now() - 90_000).toISOString();

    console.log('🌐 [AUTH] Calling Cloudflare Worker to trigger deletion...');

    // Retry a few times in case of a transient worker failure.
    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response;
      let result: any;

      try {
        response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
        result = await response.json();
      } catch (parseErr) {
        lastError = parseErr;
        console.warn(`⚠️ [AUTH] Attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying...`);
        await sleep(800);
        continue;
      }

      if (!response.ok) {
        const reason = result.details ? `${result.error} (${result.details})` : result.error;
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          lastError = new Error(reason || 'Failed to delete Firebase users');
          console.warn(`⚠️ [AUTH] Attempt ${attempt}/${MAX_ATTEMPTS} got ${response.status}, retrying...`);
          await sleep(800);
          continue;
        }
        throw new Error(reason || 'Failed to delete Firebase users');
      }

      // Legacy direct response (no GitHub relay)
      if (!result.started) {
        console.log(`✅ [AUTH] Successfully deleted ${result.deletedCount} users`);
        return result;
      }

      // Relay accepted the request — wait for the GitHub Action to finish
      console.log('🚀 [AUTH] Deletion dispatched to GitHub Actions, waiting for completion...');
      const conclusion = await waitForGithubRunCompletion(workerUrl, startedAtIso);

      if (conclusion !== 'success') {
        throw new Error(
          `GitHub deletion finished with "${conclusion}" — see the repository's Actions tab`
        );
      }

      console.log('✅ [AUTH] GitHub Action completed successfully');
      return { success: true, message: 'Deleted via GitHub Actions' };
    }

    throw lastError instanceof Error ? lastError : new Error('Worker unreachable');
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
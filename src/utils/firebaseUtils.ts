import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { initializePlayersSafe } from './firebaseMigration';
import { initializeMatchesSafe } from './firebaseMigration';

export const loadPlayers = async () => {
  console.log('🔄 [LOAD] loadPlayers() called');
  
  try {
    const playersRef = collection(db, 'players');
    
    // STEP 1: Check if collection is empty using simple query (no orderBy)
    console.log('📊 [LOAD] Checking if players collection exists...');
    const simpleQuery = query(playersRef);
    const checkSnapshot = await getDocs(simpleQuery);
    
    console.log('📊 [LOAD] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      console.log('⚠️ [LOAD] No players found, initializing...');
      console.log('🚀 [LOAD] Calling initializePlayers() now...');
      
      try {
        await initializePlayersSafe();
        console.log('✅ [LOAD] Players initialized successfully');
      } catch (initError) {
        console.error('❌ [LOAD] Player initialization FAILED:', initError);
        // Return empty arrays instead of recursing infinitely
        return { femalePlayers: [], malePlayers: [] };
      }
      
      console.log('🔁 [LOAD] Reloading players after initialization...');
      // One retry only - no infinite recursion
      const retrySnapshot = await getDocs(simpleQuery);
      
      if (retrySnapshot.empty) {
        console.error('❌ [LOAD] Still no players after successful initialization! Database issue?');
        return { femalePlayers: [], malePlayers: [] };
      }
      
      // Process the retry snapshot below
      const players = retrySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Continue to processing
      if (players && players.length > 0) {
        const females = players.filter((p: any) => p.gender === 'female').map((p: any) => ({
          id: p.id, // Preserve Firestore document ID
          name: p.name,
          points: p.points,
          totalScores: p.total_scores
        }));
        
        const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
          id: p.id, // Preserve Firestore document ID
          name: p.name,
          points: p.points,
          totalScores: p.total_scores
        }));

        console.log('✅ [LOAD] Female players:', females.length);
        console.log('✅ [LOAD] Male players:', males.length);
        console.log('📊 [LOAD] Expected: 8 female + 8 male = 16 total');

        // CRITICAL: Sort rankings by points (descending), then by totalScores (descending) as tiebreaker
        // Rank #1 = highest points, if tied → higher total score wins
        // Final fallback: player ID for deterministic ordering
        females.sort((a: any, b: any) => {
          // Primary sort: points (highest first)
          if (b.points !== a.points) return b.points - a.points;
          // Secondary sort (tiebreaker): totalScores (highest first)
          if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
          // Final fallback: player ID for deterministic ordering
          return (a.id || '').localeCompare(b.id || '');
        });
        
        males.sort((a: any, b: any) => {
          // Primary sort: points (highest first)
          if (b.points !== a.points) return b.points - a.points;
          // Secondary sort (tiebreaker): totalScores (highest first)
          if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
          // Final fallback: player ID for deterministic ordering
          return (a.id || '').localeCompare(b.id || '');
        });
        
        console.log('📊 [LOAD] Top ranked Female:', females[0]?.name, '-', females[0]?.points, 'points');
        console.log('📊 [LOAD] Top ranked Male:', males[0]?.name, '-', males[0]?.points, 'points');

        if (females.length === 8 && males.length === 8) {
          console.log('✅ [LOAD] PLAYERS LOADED SUCCESSFULLY');
          return { femalePlayers: females, malePlayers: males };
        }

        // Handle duplicates or incorrect counts
        if (females.length > 8 || males.length > 8) {
          console.log('⚠️ [LOAD] Duplicate players detected. Selecting top 8 by points...');
          
          const uniqueFemales = [];
          const seenFemaleNames = new Set();
          for (const player of females) {
            if (!seenFemaleNames.has(player.name)) {
              seenFemaleNames.add(player.name);
              uniqueFemales.push(player);
              if (uniqueFemales.length >= 8) break;
            }
          }
          
          const uniqueMales = [];
          const seenMaleNames = new Set();
          for (const player of males) {
            if (!seenMaleNames.has(player.name)) {
              seenMaleNames.add(player.name);
              uniqueMales.push(player);
              if (uniqueMales.length >= 8) break;
            }
          }
          
          console.log('✅ [LOAD] Selected unique - Female:', uniqueFemales.length, 'Male:', uniqueMales.length);
          return { femalePlayers: uniqueFemales, malePlayers: uniqueMales };
        }
      }
      
      console.log('⚠️ [LOAD] Insufficient players after retry.');
      return { femalePlayers: [], malePlayers: [] };
    }

    // STEP 2: Collection has data - load without orderBy first (avoid index issues)
    console.log('📊 [LOAD] Players exist, loading data...');
    const snapshot = await getDocs(simpleQuery);
    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('✅ [LOAD] Players loaded:', players.length);

    if (players && players.length > 0) {
      const females = players.filter((p: any) => p.gender === 'female').map((p: any) => ({
        id: p.id, // Preserve Firestore document ID
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));
      
      const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
        id: p.id, // Preserve Firestore document ID
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));

      console.log('✅ [LOAD] Female players:', females.length);
      console.log('✅ [LOAD] Male players:', males.length);
      console.log('📊 [LOAD] Expected: 8 female + 8 male = 16 total');

      // CRITICAL: Sort rankings by points (descending), then by totalScores (descending) as tiebreaker
      // Rank #1 = highest points, if tied → higher total score wins
      // Final fallback: player ID for deterministic ordering
      females.sort((a: any, b: any) => {
        // Primary sort: points (highest first)
        if (b.points !== a.points) return b.points - a.points;
        // Secondary sort (tiebreaker): totalScores (highest first)
        if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
        // Final fallback: player ID for deterministic ordering
        return (a.id || '').localeCompare(b.id || '');
      });
      
      males.sort((a: any, b: any) => {
        // Primary sort: points (highest first)
        if (b.points !== a.points) return b.points - a.points;
        // Secondary sort (tiebreaker): totalScores (highest first)
        if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
        // Final fallback: player ID for deterministic ordering
        return (a.id || '').localeCompare(b.id || '');
      });
      
      console.log('📊 [LOAD] Top ranked Female:', females[0]?.name, '-', females[0]?.points, 'points');
      console.log('📊 [LOAD] Top ranked Male:', males[0]?.name, '-', males[0]?.points, 'points');

      // If we have the exact count expected, return the data
      if (females.length === 8 && males.length === 8) {
        console.log('✅ [LOAD] PLAYERS LOADED SUCCESSFULLY');
        return { femalePlayers: females, malePlayers: males };
      }

      // Handle duplicates or incorrect counts
      if (females.length > 8 || males.length > 8) {
        console.log('⚠️ [LOAD] Duplicate players detected. Selecting top 8 by points...');
        
        const uniqueFemales = [];
        const seenFemaleNames = new Set();
        for (const player of females) {
          if (!seenFemaleNames.has(player.name)) {
            seenFemaleNames.add(player.name);
            uniqueFemales.push(player);
            if (uniqueFemales.length >= 8) break;
          }
        }
        
        const uniqueMales = [];
        const seenMaleNames = new Set();
        for (const player of males) {
          if (!seenMaleNames.has(player.name)) {
            seenMaleNames.add(player.name);
            uniqueMales.push(player);
            if (uniqueMales.length >= 8) break;
          }
        }
        
        console.log('✅ [LOAD] Selected unique - Female:', uniqueFemales.length, 'Male:', uniqueMales.length);
        return { femalePlayers: uniqueFemales, malePlayers: uniqueMales };
      }

      console.log('⚠️ [LOAD] Insufficient players. Female:', females.length, 'Male:', males.length);
      // Don't reinitialize here - let the caller decide
      return { femalePlayers: females, malePlayers: males };
    }
  } catch (error) {
    console.error('❌ [LOAD] loadPlayers() FAILED:', error);
    return { femalePlayers: [], malePlayers: [] };
  }
  
  console.log('⚠️ [LOAD] loadPlayers() returned empty arrays');
  return { femalePlayers: [], malePlayers: [] };
};

// Helper function to process matches data (extracted to avoid duplication)
function processMatches(matches: any[]) {
  const femaleMatches = matches
    .filter(m => m.gender === 'female')
    .map(m => ({
      id: m.id,
      match_number: Number(m.match_number),
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      player3_id: m.player3_id,
      player4_id: m.player4_id,
      score1: m.score1 || 0,
      score2: m.score2 || 0,
      isSubmitted: m.is_completed || false
    }))
    .sort((a, b) => a.match_number - b.match_number);

  const maleMatches = matches
    .filter(m => m.gender === 'male')
    .map(m => ({
      id: m.id,
      match_number: Number(m.match_number),
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      player3_id: m.player3_id,
      player4_id: m.player4_id,
      score1: m.score1 || 0,
      score2: m.score2 || 0,
      isSubmitted: m.is_completed || false
    }))
    .sort((a, b) => a.match_number - b.match_number);

  return { femaleMatches, maleMatches };
}

export const loadMatches = async (femalePlayers?: any[], malePlayers?: any[]) => {
  console.log('🔄 [MATCH LOAD] loadMatches() called');
  console.log('📊 [MATCH LOAD] Available players - Female:', femalePlayers?.length || 0, 'Male:', malePlayers?.length || 0);
  
  try {
    const matchesRef = collection(db, 'matches');
    
    // STEP 1: Check if collection is empty using simple query (no orderBy)
    console.log('📊 [MATCH LOAD] Checking if matches collection exists...');
    const simpleQuery = query(matchesRef);
    const checkSnapshot = await getDocs(simpleQuery);

    console.log('📊 [MATCH LOAD] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      console.log('⚠️ [MATCH LOAD] No matches found in database');
      
      // Fix: Check if draw has been completed — if so, matches should exist, don't reinitialize
      const settingsSnap = await getDoc(doc(db, 'tournamentSettings', 'settings'));
      const drawCompleted = settingsSnap.exists() && settingsSnap.data()?.draw_completed === true;

      if (drawCompleted) {
        // Draw was saved but matches are missing — this is a race condition, retry once after delay
        console.warn('⚠️ [MATCH LOAD] Draw completed but no matches found — retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        const retrySnap = await getDocs(simpleQuery);
        if (retrySnap.empty) {
          console.error('❌ [MATCH LOAD] Still no matches after retry. Draw may need to be re-saved.');
          return { femaleMatches: [], maleMatches: [] };
        }
        // Process retrySnap normally
        const matches = retrySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`✅ [MATCH LOAD] Retry successful, loaded ${matches.length} matches`);
        return processMatches(matches);
      }

      // No draw yet — safe to auto-initialize
      console.log('🚀 [MATCH LOAD] Initializing matches now...');
      
      try {
        await initializeMatchesSafe();
        console.log('✅ [MATCH LOAD] Matches initialized successfully');
      } catch (initError) {
        console.error('❌ [MATCH LOAD] Match initialization FAILED:', initError);
        return { femaleMatches: [], maleMatches: [] };
      }
      
      console.log('🔁 [MATCH LOAD] Reloading matches after initialization...');
      // One retry only - no infinite recursion
      const retrySnapshot = await getDocs(simpleQuery);
      
      if (retrySnapshot.empty) {
        console.error('❌ [MATCH LOAD] Still no matches after successful initialization! Database issue?');
        return { femaleMatches: [], maleMatches: [] };
      }
      
      // Process the retry snapshot below - continue to STEP 2
      console.log('📊 [MATCH LOAD] Retry successful, proceeding with orderBy query...');
      const orderedQuery = query(matchesRef, orderBy('match_number', 'asc'));
      const snapshot = await getDocs(orderedQuery);
      
      const matches = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`📄 [MATCH LOAD] Match #${data.match_number}:`, {
          id: doc.id,
          gender: data.gender,
          player1_id: data.player1_id,
          player2_id: data.player2_id,
          is_completed: data.is_completed
        });
        return {
          id: doc.id,
          ...data
        };
      });
      
      console.log('✅ [MATCH LOAD] Total matches loaded:', matches.length);
      
      // Continue processing matches below...
      if (matches && matches.length > 0) {
        const { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData } = processMatches(matches);

        console.log('✅ [MATCH LOAD] Female matches:', femaleMatchesData.length,
          'order:', femaleMatchesData.map((m: any) => m.match_number));
        console.log('✅ [MATCH LOAD] Male matches:', maleMatchesData.length,
          'order:', maleMatchesData.map((m: any) => m.match_number));
        console.log('📊 [MATCH LOAD] Expected: 14 female + 14 male = 28 total');

        if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
          console.log('⚠️ [MATCH LOAD] Incorrect match count! Female:', femaleMatchesData.length, 'Male:', maleMatchesData.length);
          console.log('💡 [MATCH LOAD] Admin can reinitialize matches from Admin Panel if needed');
        }

        console.log('✅ [MATCH LOAD] MATCHES LOADED SUCCESSFULLY');
        return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };
      }
    }

    // STEP 2: Collection has data - load without orderBy first (avoid index issues)
    console.log('📊 [MATCH LOAD] Matches exist, loading with simple query...');
    const snapshot = await getDocs(simpleQuery);

    const matches = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`📄 [MATCH LOAD] Match #${data.match_number}:`, {
        id: doc.id,
        gender: data.gender,
        player1_id: data.player1_id,
        player2_id: data.player2_id,
        is_completed: data.is_completed
      });
      return {
        id: doc.id,
        ...data
      };
    });

    console.log('✅ [MATCH LOAD] Total matches loaded:', matches.length);

    if (matches && matches.length > 0) {
      // Use helper function for consistent processing
      const { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData } = processMatches(matches);

      console.log('✅ [MATCH LOAD] Female matches:', femaleMatchesData.length,
        'order:', femaleMatchesData.map((m: any) => m.match_number));
      console.log('✅ [MATCH LOAD] Male matches:', maleMatchesData.length,
        'order:', maleMatchesData.map((m: any) => m.match_number));
      console.log('📊 [MATCH LOAD] Expected: 14 female + 14 male = 28 total');

      // Check if we have the wrong number of matches
      if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
        console.log('⚠️ [MATCH LOAD] Incorrect match count! Female:', femaleMatchesData.length, 'Male:', maleMatchesData.length);
        console.log('💡 [MATCH LOAD] Admin can reinitialize matches from Admin Panel if needed');
        // Don't auto-reinitialize - this can cause loops. Let admin handle it.
      }

      console.log('✅ [MATCH LOAD] MATCHES LOADED SUCCESSFULLY');
      return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };
    }
  } catch (error) {
    console.error('❌ [MATCH LOAD] loadMatches() FAILED:', error);
    return { femaleMatches: [], maleMatches: [] };
  }
  
  console.log('⚠️ [MATCH LOAD] loadMatches() returned empty arrays');
  return { femaleMatches: [], maleMatches: [] };
};

export const loadFinalMatch = async () => {
  console.log('🔄 [FINAL MATCH] Loading final match...');
  try {
    const finalMatchRef = collection(db, 'finalMatches');
    
    // STEP 1: Check if collection is empty using simple query (no orderBy)
    console.log('📊 [FINAL MATCH] Checking if finalMatches collection exists...');
    const simpleQuery = query(finalMatchRef);
    const checkSnapshot = await getDocs(simpleQuery);
    
    console.log('📊 [FINAL MATCH] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      console.log('ℹ️ [FINAL MATCH] No final match yet - this is normal before semifinals complete');
      return null;
    }

    // STEP 2: Collection has data - use simple query (avoid orderBy to prevent index issues)
    console.log('📊 [FINAL MATCH] Final matches exist, loading data...');
    const snapshot = await getDocs(simpleQuery);

    // Safety check: ensure we have documents
    if (snapshot.empty || snapshot.docs.length === 0) {
      console.log('⚠️ [FINAL MATCH] No documents found');
      return null;
    }

    // Return first document (we only expect one anyway)
    const firstDoc = snapshot.docs[0];
    const result = { id: firstDoc.id, ...firstDoc.data() };
    console.log('✅ [FINAL MATCH] Loaded successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ [FINAL MATCH] Error loading final match:', error);
    return null;
  }
};

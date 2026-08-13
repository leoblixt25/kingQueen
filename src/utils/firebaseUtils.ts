import { db } from '@/config/firebase';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { initializePlayersSafe } from './firebaseMigration';
import { validateMatches, buildValidationMap } from './matchValidation';

// Display name for public surfaces (rankings, matchups). Registered players only
// appear with their real name AFTER admin approval. Otherwise their placeholder
// name (e.g. "Female Player 3") is shown, matching pre-registration state.
export const getPublicDisplayName = (player: any): string => {
  const isApproved = player?.status === 'approved' || player?.is_confirmed === true;
  if (isApproved || !player?.name) return player?.name;

  const prefix = player.gender === 'male' ? 'Male Player' : 'Female Player';
  return player.position != null ? `${prefix} ${player.position}` : prefix;
};

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
          name: getPublicDisplayName(p),
          points: p.points,
          totalScores: p.total_scores
        }));
        
        const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
          id: p.id, // Preserve Firestore document ID
          name: getPublicDisplayName(p),
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
        name: getPublicDisplayName(p),
        points: p.points,
        totalScores: p.total_scores
      }));
      
      const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
        id: p.id, // Preserve Firestore document ID
        name: getPublicDisplayName(p),
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

/**
 * Load matches from Firestore
 * CRITICAL: This function ONLY loads matches, NEVER generates them
 * Match generation happens ONLY in DrawPage when user clicks "Start Draw"
 */
export const loadMatches = async (femalePlayers?: any[], malePlayers?: any[]) => {
  console.log('🔄 [MATCH LOAD] loadMatches() called');

  try {
    const matchesRef = collection(db, 'matches');
    const simpleQuery = query(matchesRef);
    const snapshot = await getDocs(simpleQuery);

    if (snapshot.empty) {
      console.log('ℹ️ [MATCH LOAD] No matches in collection');
      return { femaleMatches: [], maleMatches: [] };
    }

    // Convert Firestore data to Match format with teamA/teamB
    const matches = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data
      };
    });

    // Filter and map to teamA/teamB structure
    const femaleMatchesData = matches
      .filter((m: any) => m.gender === 'female')
      .map((m: any) => ({
        id: m.id,
        match_number: Number(m.match_number),
        gender: 'female' as const,
        teamA: [m.player1_id, m.player2_id] as [string, string],
        teamB: [m.player3_id, m.player4_id] as [string, string],
        score1: m.score1 || 0,
        score2: m.score2 || 0,
        isSubmitted: m.is_completed || false
      }))
      .sort((a: any, b: any) => Number(a.match_number) - Number(b.match_number));

    const maleMatchesData = matches
      .filter((m: any) => m.gender === 'male')
      .map((m: any) => ({
        id: m.id,
        match_number: Number(m.match_number),
        gender: 'male' as const,
        teamA: [m.player1_id, m.player2_id] as [string, string],
        teamB: [m.player3_id, m.player4_id] as [string, string],
        score1: m.score1 || 0,
        score2: m.score2 || 0,
        isSubmitted: m.is_completed || false
      }))
      .sort((a: any, b: any) => Number(a.match_number) - Number(b.match_number));

    console.log('✅ [MATCH LOAD] Loaded', femaleMatchesData.length, 'female +', maleMatchesData.length, 'male matches');

    // STRICT VALIDATION: If players provided, validate matches
    if (femalePlayers?.length === 8 && malePlayers?.length === 8) {
      const playerMap = buildValidationMap([...femalePlayers, ...malePlayers]);
      validateMatches(femaleMatchesData, playerMap);
      validateMatches(maleMatchesData, playerMap);
      console.log('✅ [MATCH LOAD] All matches validated');
    }

    return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };

  } catch (error) {
    console.error('❌ [MATCH LOAD] Failed:', error);
    throw error; // Fail fast - let caller handle the error
  }
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

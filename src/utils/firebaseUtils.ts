import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches as initSimpleMatches } from './matchInitUtils';

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
        await initializePlayers();
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
          name: p.name,
          points: p.points,
          totalScores: p.total_scores
        }));
        
        const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
          name: p.name,
          points: p.points,
          totalScores: p.total_scores
        }));

        console.log('✅ [LOAD] Female players:', females.length);
        console.log('✅ [LOAD] Male players:', males.length);
        console.log('📊 [LOAD] Expected: 8 female + 8 male = 16 total');

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

    // STEP 2: Collection has data - now use orderBy for proper sorting
    console.log('📊 [LOAD] Players exist, loading with orderBy query...');
    const orderedQuery = query(playersRef, orderBy('points', 'desc'), orderBy('total_scores', 'desc'));
    const snapshot = await getDocs(orderedQuery);
    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('✅ [LOAD] Players loaded:', players.length);

    if (players && players.length > 0) {
      const females = players.filter((p: any) => p.gender === 'female').map((p: any) => ({
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));
      
      const males = players.filter((p: any) => p.gender === 'male').map((p: any) => ({
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));

      console.log('✅ [LOAD] Female players:', females.length);
      console.log('✅ [LOAD] Male players:', males.length);
      console.log('📊 [LOAD] Expected: 8 female + 8 male = 16 total');

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

export const loadMatches = async () => {
  console.log('🔄 [MATCH LOAD] loadMatches() called');
  
  try {
    const matchesRef = collection(db, 'matches');
    
    // STEP 1: Check if collection is empty using simple query (no orderBy)
    console.log('📊 [MATCH LOAD] Checking if matches collection exists...');
    const simpleQuery = query(matchesRef);
    const checkSnapshot = await getDocs(simpleQuery);

    console.log('📊 [MATCH LOAD] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      console.log('⚠️ [MATCH LOAD] No matches found in database');
      console.log('💡 [MATCH LOAD] Matches will be initialized after players are loaded');
      // Don't try to initialize here - let it happen after players are confirmed
      return { femaleMatches: [], maleMatches: [] };
    }

    // STEP 2: Collection has data - now use orderBy for proper sorting
    console.log('📊 [MATCH LOAD] Matches exist, loading with orderBy query...');
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

    if (matches && matches.length > 0) {
      // Filter by gender field (which actually exists in the database)
      const femaleMatchesData = matches
        .filter((m: any) => m.gender === 'female')
        .map((m: any) => ({
          id: m.id,
          match_number: m.match_number,
          player1_id: m.player1_id,
          player2_id: m.player2_id,
          player3_id: m.player3_id,
          player4_id: m.player4_id,
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_completed || false
        }));

      const maleMatchesData = matches
        .filter((m: any) => m.gender === 'male')
        .map((m: any) => ({
          id: m.id,
          match_number: m.match_number,
          player1_id: m.player1_id,
          player2_id: m.player2_id,
          player3_id: m.player3_id,
          player4_id: m.player4_id,
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_completed || false
        }));

      console.log('✅ [MATCH LOAD] Female matches:', femaleMatchesData.length);
      console.log('✅ [MATCH LOAD] Male matches:', maleMatchesData.length);
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
  console.log('Loading final match...');
  try {
    const finalMatchRef = collection(db, 'finalMatches');
    const q = query(finalMatchRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // Return first document (most recent)
    const firstDoc = snapshot.docs[0];
    return { id: firstDoc.id, ...firstDoc.data() };
  } catch (error) {
    console.error('Error loading final match:', error);
    return null;
  }
};

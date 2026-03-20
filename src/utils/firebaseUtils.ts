import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches as initSimpleMatches } from './matchInitUtils';

export const loadPlayers = async () => {
  console.log('🔄 STEP 1: loadPlayers() called');
  try {
    const playersRef = collection(db, 'players');
    console.log('📊 Firestore query: SELECT * FROM players ORDER BY points DESC');
    
    const q = query(playersRef, orderBy('points', 'desc'), orderBy('total_scores', 'desc'));
    const snapshot = await getDocs(q);

    console.log('📊 Query result:', snapshot.empty ? 'EMPTY' : `${snapshot.size} documents`);

    if (snapshot.empty) {
      console.log('⚠️ No players found, initializing...');
      await initializePlayers();
      return { femalePlayers: [], malePlayers: [] };
    }

    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('✅ Players loaded:', players.length);

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

      console.log('✅ Female players:', females.length);
      console.log('✅ Male players:', males.length);
      console.log('📊 Expected: 8 female + 8 male = 16 total');

      // If we have the exact count expected, return the data
      if (females.length === 8 && males.length === 8) {
        console.log('✅ PLAYERS LOADED SUCCESSFULLY');
        return { femalePlayers: females, malePlayers: males };
      }

      // Handle duplicates or incorrect counts
      if (females.length > 8 || males.length > 8) {
        console.log('⚠️ Duplicate players detected. Selecting top 8 by points...');
        
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
        
        console.log('✅ Selected unique - Female:', uniqueFemales.length, 'Male:', uniqueMales.length);
        return { femalePlayers: uniqueFemales, malePlayers: uniqueMales };
      }

      console.log('⚠️ Insufficient players. Female:', females.length, 'Male:', males.length, '- Reinitializing...');
      await initializePlayers();
      return { femalePlayers: [], malePlayers: [] };
    }
  } catch (error) {
    console.error('❌ loadPlayers() FAILED:', error);
    return { femalePlayers: [], malePlayers: [] };
  }
  
  console.log('⚠️ loadPlayers() returned empty arrays');
  return { femalePlayers: [], malePlayers: [] };
};

export const loadMatches = async () => {
  console.log('🔄 STEP 1: loadMatches() called');
  try {
    const matchesRef = collection(db, 'matches');
    console.log('📊 Firestore query: SELECT * FROM matches ORDER BY match_number');
    
    const q = query(matchesRef, orderBy('match_number', 'asc'));
    const snapshot = await getDocs(q);

    console.log('📊 Query result:', snapshot.empty ? 'EMPTY' : `${snapshot.size} documents`);

    if (snapshot.empty) {
      console.log('⚠️ No matches found in database');
      return { femaleMatches: [], maleMatches: [] };
    }

    const matches = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`📄 Match #${data.match_number}:`, {
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

    console.log('✅ Total matches loaded:', matches.length);

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

      console.log('✅ Female matches:', femaleMatchesData.length);
      console.log('✅ Male matches:', maleMatchesData.length);
      console.log('📊 Expected: 14 female + 14 male = 28 total');

      // Check if we have the wrong number of matches
      if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
        console.log('❌ Incorrect match count! Will reinitialize...');
        await initSimpleMatches();
        return { femaleMatches: [], maleMatches: [] };
      }

      console.log('✅ MATCHES LOADED SUCCESSFULLY');
      return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };
    }
  } catch (error) {
    console.error('❌ loadMatches() FAILED:', error);
    return { femaleMatches: [], maleMatches: [] };
  }
  
  console.log('⚠️ loadMatches() returned empty arrays');
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

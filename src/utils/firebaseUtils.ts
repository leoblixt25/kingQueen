import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { initializePlayers } from './playerInitUtils';
import { initializeMatches as initSimpleMatches } from './matchInitUtils';

export const loadPlayers = async () => {
  console.log('Loading players...');
  try {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, orderBy('points', 'desc'), orderBy('total_scores', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('No players found, initializing players...');
      await initializePlayers();
      return { femalePlayers: [], malePlayers: [] };
    }

    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('Players loaded:', players.length);

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

      console.log('Female players count:', females.length);
      console.log('Male players count:', males.length);

      // If we have the exact count expected, return the data
      if (females.length === 8 && males.length === 8) {
        return { femalePlayers: females, malePlayers: males };
      }

      // If we have duplicates, clean up and use the unique names with highest scores
      if (females.length > 8 || males.length > 8) {
        console.log('Duplicate players detected. Female:', females.length, 'Male:', males.length, '. Using top 8 by points...');
        
        // Get unique names with highest points/scores for each gender
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
        
        console.log('Unique females selected:', uniqueFemales);
        console.log('Unique males selected:', uniqueMales);
        
        return { femalePlayers: uniqueFemales, malePlayers: uniqueMales };
      }

      // If we have less than 8, reinitialize
      console.log('Insufficient player count detected. Female:', females.length, 'Male:', males.length, '. Reinitializing...');
      await initializePlayers();
      return { femalePlayers: [], malePlayers: [] };
    }
  } catch (error) {
    console.error('Error loading players:', error);
    return { femalePlayers: [], malePlayers: [] };
  }
  
  return { femalePlayers: [], malePlayers: [] };
};

export const loadMatches = async () => {
  console.log('Loading matches...');
  try {
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, orderBy('match_number', 'asc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('No matches found, will initialize after players are created');
      return { femaleMatches: [], maleMatches: [] };
    }

    const matches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('Matches loaded:', matches.length);

    if (matches && matches.length > 0) {
      // Separate by gender first based on match_number convention
      // Female matches: 1-14, Male matches: 15-28
      const femaleMatchesData = matches
        .filter((m: any) => m.match_number >= 1 && m.match_number <= 14)
        .map((m: any) => ({
          id: m.id,
          player1: { name: m.player1_name || 'TBD', points: 0, totalScores: 0 },
          player2: { name: m.player2_name || 'TBD', points: 0, totalScores: 0 },
          player3: { name: m.player3_name || 'TBD', points: 0, totalScores: 0 },
          player4: { name: m.player4_name || 'TBD', points: 0, totalScores: 0 },
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_completed || false
        }));

      const maleMatchesData = matches
        .filter((m: any) => m.match_number >= 15 && m.match_number <= 28)
        .map((m: any) => ({
          id: m.id,
          player1: { name: m.player1_name || 'TBD', points: 0, totalScores: 0 },
          player2: { name: m.player2_name || 'TBD', points: 0, totalScores: 0 },
          player3: { name: m.player3_name || 'TBD', points: 0, totalScores: 0 },
          player4: { name: m.player4_name || 'TBD', points: 0, totalScores: 0 },
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_completed || false
        }));

      console.log('Female matches count:', femaleMatchesData.length);
      console.log('Male matches count:', maleMatchesData.length);

      // Check if we have the wrong number of matches and need to reinitialize
      if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
        console.log('Incorrect match count detected. Female:', femaleMatchesData.length, 'Male:', maleMatchesData.length, '. Reinitializing...');
        await initSimpleMatches();
        return { femaleMatches: [], maleMatches: [] };
      }

      return { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData };
    }
  } catch (error) {
    console.error('Error loading matches:', error);
    return { femaleMatches: [], maleMatches: [] };
  }
  
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

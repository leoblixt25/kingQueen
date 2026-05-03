import { db } from '@/config/firebase';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { initializePlayersSafe } from './firebaseMigration';
import { initializeMatchesSafe } from './firebaseMigration';

export const loadPlayers = async () => {
  console.log('🔄 [LOAD] loadPlayers() called');

  try {
    const playersRef = collection(db, 'players');
    const simpleQuery = query(playersRef);
    const checkSnapshot = await getDocs(simpleQuery);

    console.log('📊 [LOAD] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      try {
        await initializePlayersSafe();
      } catch (initError) {
        console.error('❌ [LOAD] Player initialization FAILED:', initError);
        return { femalePlayers: [], malePlayers: [] };
      }
      const retrySnapshot = await getDocs(simpleQuery);
      if (retrySnapshot.empty) return { femalePlayers: [], malePlayers: [] };
      const players = retrySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return processPlayers(players);
    }

    const players = checkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return processPlayers(players);

  } catch (error) {
    console.error('❌ [LOAD] loadPlayers() FAILED:', error);
    return { femalePlayers: [], malePlayers: [] };
  }
};

function processPlayers(players: any[]) {
  const females = players
    .filter((p: any) => p.gender === 'female')
    .map((p: any) => ({ id: p.id, name: p.name, points: p.points, totalScores: p.total_scores }))
    .sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
      return (a.id || '').localeCompare(b.id || '');
    });

  const males = players
    .filter((p: any) => p.gender === 'male')
    .map((p: any) => ({ id: p.id, name: p.name, points: p.points, totalScores: p.total_scores }))
    .sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.totalScores !== a.totalScores) return b.totalScores - a.totalScores;
      return (a.id || '').localeCompare(b.id || '');
    });

  console.log('✅ [LOAD] Female players:', females.length, '| Male players:', males.length);

  // Deduplicate if needed
  const dedupe = (list: any[], limit: number) => {
    const seen = new Set();
    const result = [];
    for (const p of list) {
      if (!seen.has(p.name)) { seen.add(p.name); result.push(p); }
      if (result.length >= limit) break;
    }
    return result;
  };

  return {
    femalePlayers: females.length > 8 ? dedupe(females, 8) : females,
    malePlayers:   males.length   > 8 ? dedupe(males, 8)   : males,
  };
}

function processMatches(matches: any[]) {
  const femaleMatches = matches
    .filter((m: any) => m.gender === 'female')
    .map((m: any) => ({
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
    .sort((a: any, b: any) => a.match_number - b.match_number);

  const maleMatches = matches
    .filter((m: any) => m.gender === 'male')
    .map((m: any) => ({
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
    .sort((a: any, b: any) => a.match_number - b.match_number);

  console.log('✅ [MATCH LOAD] Female:', femaleMatches.length, '| Male:', maleMatches.length);
  return { femaleMatches, maleMatches };
}

export const loadMatches = async (femalePlayers?: any[], malePlayers?: any[]) => {
  console.log('🔄 [MATCH LOAD] loadMatches() called');

  try {
    const matchesRef = collection(db, 'matches');
    const simpleQuery = query(matchesRef);
    const checkSnapshot = await getDocs(simpleQuery);

    console.log('📊 [MATCH LOAD] Collection check:', checkSnapshot.empty ? 'EMPTY' : `${checkSnapshot.size} documents`);

    if (checkSnapshot.empty) {
      // ── No matches in Firestore ──
      // Only auto-initialize if draw has NOT been completed yet.
      // If draw IS complete, matches were deleted mid-save or save failed — do NOT reinitialize.
      const settingsSnap = await getDoc(doc(db, 'tournamentSettings', 'settings'));
      const drawCompleted = settingsSnap.exists() && settingsSnap.data()?.draw_completed === true;

      if (drawCompleted) {
        // Draw was saved but matches are gone — return empty, let UI show error
        console.error('❌ [MATCH LOAD] Draw completed but matches collection is empty. Re-run draw from admin panel.');
        return { femaleMatches: [], maleMatches: [] };
      }

      // Safe to auto-initialize with placeholders
      console.log('🚀 [MATCH LOAD] No draw yet — initializing placeholder matches...');
      try {
        await initializeMatchesSafe();
      } catch (initError) {
        console.error('❌ [MATCH LOAD] Match initialization FAILED:', initError);
        return { femaleMatches: [], maleMatches: [] };
      }

      const retrySnapshot = await getDocs(simpleQuery);
      if (retrySnapshot.empty) {
        console.error('❌ [MATCH LOAD] Still no matches after initialization.');
        return { femaleMatches: [], maleMatches: [] };
      }

      const matches = retrySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return processMatches(matches);
    }

    // ── Matches exist — load them ──
    const matches = checkSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const result = processMatches(matches);

    if (result.femaleMatches.length !== 14 || result.maleMatches.length !== 14) {
      console.warn('⚠️ [MATCH LOAD] Unexpected match count. Female:', result.femaleMatches.length, 'Male:', result.maleMatches.length);
    }

    return result;

  } catch (error) {
    console.error('❌ [MATCH LOAD] loadMatches() FAILED:', error);
    return { femaleMatches: [], maleMatches: [] };
  }
};

export const loadFinalMatch = async () => {
  console.log('🔄 [FINAL MATCH] Loading final match...');
  try {
    const finalMatchRef = collection(db, 'finalMatches');
    const simpleQuery = query(finalMatchRef);
    const checkSnapshot = await getDocs(simpleQuery);

    if (checkSnapshot.empty) {
      console.log('ℹ️ [FINAL MATCH] No final match yet.');
      return null;
    }

    const firstDoc = checkSnapshot.docs[0];
    const result = { id: firstDoc.id, ...firstDoc.data() };
    console.log('✅ [FINAL MATCH] Loaded:', result);
    return result;
  } catch (error) {
    console.error('❌ [FINAL MATCH] Error:', error);
    return null;
  }
};

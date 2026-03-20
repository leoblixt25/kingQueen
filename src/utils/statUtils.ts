import { db } from "@/config/firebase";
import { collection, getDocs, query, where, doc, updateDoc, writeBatch } from "firebase/firestore";

export async function recalculatePlayerStats() {
  try {
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, where('is_completed', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('No completed matches found');
      return;
    }

    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const playerStats = new Map<string, { total: number; points: number }>();

    matches.forEach((match: any) => {
      const { score1, score2 } = match;

      const team1 = [match.player1_id, match.player2_id];
      const team2 = [match.player3_id, match.player4_id];

      if (score1 > score2) {
        team1.forEach((id) => updateStats(playerStats, id, score1, 3));
        team2.forEach((id) => updateStats(playerStats, id, score2, 1));
      } else {
        team1.forEach((id) => updateStats(playerStats, id, score1, 1));
        team2.forEach((id) => updateStats(playerStats, id, score2, 3));
      }
    });

    // Batch update all players
    const batch = writeBatch(db);
    
    for (const [playerId, stats] of playerStats.entries()) {
      const playerRef = doc(db, 'players', playerId);
      batch.update(playerRef, {
        total_scores: stats.total,
        points: stats.points,
      });
    }

    await batch.commit();
    console.log('Player stats recalculated successfully');
  } catch (error) {
    console.error('Error recalculating player stats:', error);
  }
}

function updateStats(
  map: Map<string, { total: number; points: number }>,
  playerId: string,
  score: number,
  points: number
) {
  if (!map.has(playerId)) {
    map.set(playerId, { total: 0, points: 0 });
  }
  const stats = map.get(playerId)!;
  stats.total += score;
  stats.points += points;
}

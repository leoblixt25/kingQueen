import { supabase } from "@/integrations/supabase/client";

export async function recalculatePlayerStats() {
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("is_completed", true);

  if (matchError || !matches) {
    console.error("Failed to fetch matches", matchError);
    return;
  }

  const playerStats = new Map<string, { total: number; points: number }>();

  matches.forEach((match) => {
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

  // Push updated stats to Supabase
  for (const [playerId, stats] of playerStats.entries()) {
    const { error } = await supabase
      .from("players")
      .update({
        total_scores: stats.total,
        points: stats.points,
      })
      .eq("id", playerId);

    if (error) {
      console.error(`Error updating player ${playerId}:`, error);
    }
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


import { supabase } from '@/integrations/supabase/client';
import { FinalMatchScores, Player } from '@/types';

export const updateFinalMatch = async (scores: FinalMatchScores, malePlayers: Player[], femalePlayers: Player[]) => {
  const team1Wins = scores.team1.filter((score, index) => 
    score !== null && scores.team2[index] !== null && score > scores.team2[index]!
  ).length;
  
  const team2Wins = scores.team2.filter((score, index) => 
    score !== null && scores.team1[index] !== null && score > scores.team1[index]!
  ).length;

  // Calculate total scores for each team
  const team1TotalScore = scores.team1.reduce((sum, score) => sum + (score || 0), 0);
  const team2TotalScore = scores.team2.reduce((sum, score) => sum + (score || 0), 0);

  // Get player IDs by looking them up in the database
  const { data: allPlayers } = await supabase.from('players').select('id, name, gender');
  
  const getPlayerId = (name: string, gender: string) => {
    return allPlayers?.find(p => p.name === name && p.gender === gender)?.id || null;
  };

  let winnerTeam = null;
  let maleKingId = null;
  let femaleQueenId = null;
  let malePrinceId = null;
  let femalePrincessId = null;

  if (team1Wins > team2Wins) {
    winnerTeam = 1;
    maleKingId = getPlayerId(malePlayers[0]?.name, 'male');
    femaleQueenId = getPlayerId(femalePlayers[1]?.name, 'female');
    malePrinceId = getPlayerId(malePlayers[1]?.name, 'male');
    femalePrincessId = getPlayerId(femalePlayers[0]?.name, 'female');
  } else if (team2Wins > team1Wins) {
    winnerTeam = 2;
    maleKingId = getPlayerId(malePlayers[1]?.name, 'male');
    femaleQueenId = getPlayerId(femalePlayers[0]?.name, 'female');
    malePrinceId = getPlayerId(malePlayers[0]?.name, 'male');
    femalePrincessId = getPlayerId(femalePlayers[1]?.name, 'female');
  }

  const { error } = await supabase
    .from('final_matches')
    .upsert({
      team1_score: team1TotalScore,
      team2_score: team2TotalScore,
      is_completed: true,
      winner_team: winnerTeam,
      male_king_id: maleKingId,
      female_queen_id: femaleQueenId,
      male_prince_id: malePrinceId,
      female_princess_id: femalePrincessId,
      completed_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error updating final match:', error);
  }
};

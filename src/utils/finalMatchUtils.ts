import { supabase } from '@/integrations/supabase/client';
import { FinalMatchScores, Player } from '@/types';

export const updateFinalMatch = async (scores: FinalMatchScores, malePlayers: Player[], femalePlayers: Player[], tournamentType: string) => {
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

  // Adjust final match logic based on tournament type
  if (tournamentType === 'female') {
    // For "Queen of the Beach" - only female players
    // Top 4 female players: Player #1, Player #2, Player #3, Player #4
    if (team1Wins > team2Wins) {
      winnerTeam = 1;
      // Team 1: Player #1 and Player #2
      femaleQueenId = getPlayerId(femalePlayers[0]?.name, 'female');
      femalePrincessId = getPlayerId(femalePlayers[1]?.name, 'female');
    } else if (team2Wins > team1Wins) {
      winnerTeam = 2;
      // Team 2: Player #3 and Player #4
      femaleQueenId = getPlayerId(femalePlayers[2]?.name, 'female');
      femalePrincessId = getPlayerId(femalePlayers[3]?.name, 'female');
    }
  } else if (tournamentType === 'male') {
    // For "King of the Beach" - only male players
    // Top 4 male players: Player #1, Player #2, Player #3, Player #4
    if (team1Wins > team2Wins) {
      winnerTeam = 1;
      // Team 1: Player #1 and Player #2
      maleKingId = getPlayerId(malePlayers[0]?.name, 'male');
      malePrinceId = getPlayerId(malePlayers[1]?.name, 'male');
    } else if (team2Wins > team1Wins) {
      winnerTeam = 2;
      // Team 2: Player #3 and Player #4
      maleKingId = getPlayerId(malePlayers[2]?.name, 'male');
      malePrinceId = getPlayerId(malePlayers[3]?.name, 'male');
    }
  } else {
    // For "King & Queen of the Beach" (mixed) - default behavior
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
  }

  const { error } = await supabase
    .from('final_matches')
    .upsert({
      team1_score: team1TotalScore,
      team2_score: team2TotalScore,
      team1_set1: scores.team1[0],
      team1_set2: scores.team1[1], 
      team1_set3: scores.team1[2],
      team2_set1: scores.team2[0],
      team2_set2: scores.team2[1],
      team2_set3: scores.team2[2],
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
    throw error;
  } else {
    console.log('✅ Final match saved successfully with individual set scores');
  }
};

// Function to automatically create final match bracket based on rankings
export const createFinalMatchBracket = async (malePlayers: Player[], femalePlayers: Player[], tournamentType: string) => {
  try {
    // For single gender tournaments, we need to adjust the bracket creation
    if (tournamentType === 'female') {
      // For "Queen of the Beach" - only female players
      // Team 1: Player #1 and Player #2
      // Team 2: Player #3 and Player #4
      console.log('Creating final match bracket for Queen of the Beach');
    } else if (tournamentType === 'male') {
      // For "King of the Beach" - only male players
      // Team 1: Player #1 and Player #2
      // Team 2: Player #3 and Player #4
      console.log('Creating final match bracket for King of the Beach');
    } else {
      // For "King & Queen of the Beach" (mixed) - default behavior
      console.log('Creating final match bracket for King & Queen of the Beach');
    }
    
    // In a real implementation, you would create the match records here
    // For now, we'll just log that the bracket should be created
    return true;
  } catch (error) {
    console.error('Error creating final match bracket:', error);
    throw error;
  }
};
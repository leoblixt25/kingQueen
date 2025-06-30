
import { supabase } from '@/integrations/supabase/client';
import { FinalMatchScores, Player } from '@/types';

export const updateFinalMatch = async (scores: FinalMatchScores, malePlayers: Player[], femalePlayers: Player[]) => {
  const team1Wins = scores.team1.filter((score, index) => 
    score !== null && scores.team2[index] !== null && score > scores.team2[index]!
  ).length;
  
  const team2Wins = scores.team2.filter((score, index) => 
    score !== null && scores.team1[index] !== null && score > scores.team1[index]!
  ).length;

  let winnerTeam = null;
  let maleWinner = null;
  let femaleWinner = null;
  let maleRunnerUp = null;
  let femaleRunnerUp = null;

  if (team1Wins > team2Wins) {
    winnerTeam = 'team1';
    maleWinner = malePlayers[0]?.name;
    femaleWinner = femalePlayers[1]?.name;
    maleRunnerUp = malePlayers[1]?.name;
    femaleRunnerUp = femalePlayers[0]?.name;
  } else if (team2Wins > team1Wins) {
    winnerTeam = 'team2';
    maleWinner = malePlayers[1]?.name;
    femaleWinner = femalePlayers[0]?.name;
    maleRunnerUp = malePlayers[0]?.name;
    femaleRunnerUp = femalePlayers[1]?.name;
  }

  const { error } = await supabase
    .from('final_matches')
    .upsert({
      team1_set1: scores.team1[0],
      team1_set2: scores.team1[1],
      team1_set3: scores.team1[2],
      team2_set1: scores.team2[0],
      team2_set2: scores.team2[1],
      team2_set3: scores.team2[2],
      is_submitted: true,
      winner_team: winnerTeam,
      male_winner: maleWinner,
      female_winner: femaleWinner,
      male_runner_up: maleRunnerUp,
      female_runner_up: femaleRunnerUp
    });

  if (error) {
    console.error('Error updating final match:', error);
  }
};

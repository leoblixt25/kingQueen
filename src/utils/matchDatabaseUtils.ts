
import { Match } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export async function saveMatchToDatabase(match: Match, score1: number, score2: number) {
  const scoreData = {
    player1_id: match.player1.id,
    player2_id: match.player2.id,
    player3_id: match.player3.id,
    player4_id: match.player4.id,
    score1: score1,
    score2: score2,
    is_submitted: true
  };

  const { error } = await supabase
    .from('matches')
    .insert(scoreData);

  if (error) {
    throw new Error(`Error saving match to Supabase: ${error.message}`);
  }
  
  console.log("Match saved to Supabase successfully");
  return { success: true };
}

export async function findMatchInDatabase(match: Match) {
  const { data: existingMatches, error: findError } = await supabase
    .from('matches')
    .select('*')
    .eq('player1_id', match.player1.id)
    .eq('player2_id', match.player2.id)
    .eq('player3_id', match.player3.id)
    .eq('player4_id', match.player4.id);
  
  if (findError) {
    throw new Error(`Error finding match: ${findError.message}`);
  }
  
  return existingMatches;
}

export async function updateMatchInDatabase(matchId: string, score1: number, score2: number) {
  const { error: updateError } = await supabase
    .from('matches')
    .update({ 
      score1: score1, 
      score2: score2 
    })
    .eq('id', matchId);
  
  if (updateError) {
    throw new Error(`Error updating match: ${updateError.message}`);
  }
  
  console.log("Match updated in database");
  return { success: true };
}

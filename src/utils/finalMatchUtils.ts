import { db } from '@/config/firebase';
import { FinalMatchScores, Player } from '@/types';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';

export const updateFinalMatch = async (scores: FinalMatchScores, malePlayers: Player[], femalePlayers: Player[], tournamentType: string) => {
  console.log('🏆 [FINAL MATCH] Starting final match update...');
  console.log('🏆 [FINAL MATCH] Scores:', scores);
  console.log('🏆 [FINAL MATCH] Tournament type:', tournamentType);
  console.log('🏆 [FINAL MATCH] Male players count:', malePlayers?.length || 0);
  console.log('🏆 [FINAL MATCH] Female players count:', femalePlayers?.length || 0);
  
  const team1Wins = scores.team1.filter((score, index) => 
    score !== null && scores.team2[index] !== null && score > scores.team2[index]!
  ).length;
  
  const team2Wins = scores.team2.filter((score, index) => 
    score !== null && scores.team1[index] !== null && score > scores.team1[index]!
  ).length;

  console.log('🏆 [FINAL MATCH] Team 1 wins:', team1Wins, 'Team 2 wins:', team2Wins);

  // Calculate total scores for each team
  const team1TotalScore = scores.team1.reduce((sum, score) => sum + (score || 0), 0);
  const team2TotalScore = scores.team2.reduce((sum, score) => sum + (score || 0), 0);

  console.log('🏆 [FINAL MATCH] Team 1 total score:', team1TotalScore, 'Team 2 total score:', team2TotalScore);

  // Get player IDs by looking them up in the database
  const playersRef = collection(db, 'players');
  const snapshot = await getDocs(playersRef);
  const allPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const getPlayerId = (name: string, gender: string) => {
    return allPlayers.find((p: any) => p.name === name && p.gender === gender)?.id || null;
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
    console.log('🏆 [FINAL MATCH] Mixed tournament - selecting top ranked players');
    console.log('🏆 [FINAL MATCH] Male rankings:', malePlayers.map((p, i) => `#${i+1} ${p.name} (${p.points}pts)`));
    console.log('🏆 [FINAL MATCH] Female rankings:', femalePlayers.map((p, i) => `#${i+1} ${p.name} (${p.points}pts)`));
    
    if (team1Wins > team2Wins) {
      winnerTeam = 1;
      // Team 1: Rank #1 Male + Rank #2 Female
      // Team 2: Rank #2 Male + Rank #1 Female
      maleKingId = getPlayerId(malePlayers[0]?.name, 'male');
      femaleQueenId = getPlayerId(femalePlayers[1]?.name, 'female');
      malePrinceId = getPlayerId(malePlayers[1]?.name, 'male');
      femalePrincessId = getPlayerId(femalePlayers[0]?.name, 'female');
      
      console.log('🏆 [FINAL MATCH] Team 1 WINS - King: Male #1, Queen: Female #2');
      console.log('🏆 [FINAL MATCH] Prince: Male #2, Princess: Female #1');
    } else if (team2Wins > team1Wins) {
      winnerTeam = 2;
      maleKingId = getPlayerId(malePlayers[1]?.name, 'male');
      femaleQueenId = getPlayerId(femalePlayers[0]?.name, 'female');
      malePrinceId = getPlayerId(malePlayers[0]?.name, 'male');
      femalePrincessId = getPlayerId(femalePlayers[1]?.name, 'female');
      
      console.log('🏆 [FINAL MATCH] Team 2 WINS - King: Male #2, Queen: Female #1');
      console.log('🏆 [FINAL MATCH] Prince: Male #1, Princess: Female #2');
    }
  }

  const finalMatchRef = doc(db, 'finalMatches', 'current');
  await setDoc(finalMatchRef, {
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
  }, { merge: true });

  console.log('✅ Final match saved successfully with individual set scores');
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

import { db } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, query, where, runTransaction, addDoc } from 'firebase/firestore';

export const DEFAULT_FEMALE_PLAYERS = [
  "Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8"
];

export const DEFAULT_MALE_PLAYERS = [
  "Player 9", "Player 10", "Player 11", "Player 12", "Player 13", "Player 14", "Player 15", "Player 16"
];

export const initializeDefaultPlayers = async () => {
  console.log('Initializing default players...');
  
  try {
    // Check if players already exist to prevent duplicates
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);

    if (!snapshot.empty) {
      console.log('Players already exist, skipping initialization');
      return;
    }

    // Insert female players
    const femaleInserts = DEFAULT_FEMALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'female',
      points: 0,
      total_scores: 0,
      position: index + 1
    }));

    await Promise.all(femaleInserts.map(player => addDoc(playersRef, player)));

    // Insert male players
    const maleInserts = DEFAULT_MALE_PLAYERS.map((name, index) => ({
      name,
      gender: 'male',
      points: 0,
      total_scores: 0,
      position: index + 9
    }));

    await Promise.all(maleInserts.map(player => addDoc(playersRef, player)));

    console.log('Default players inserted successfully');
    
  } catch (error) {
    console.error('Error in initializeDefaultPlayers:', error);
  }
};

export const updatePlayerPointsFromMatch = async (matchId: string, score1: number, score2: number, isEdit: boolean = false) => {
  console.log(`Updating player points for match ${matchId}: score1=${score1}, score2=${score2}, isEdit=${isEdit}`);
  
  try {
    const matchRef = doc(db, 'matches', matchId);
    
    await runTransaction(db, async (transaction) => {
      // Get match details
      const matchSnap = await transaction.get(matchRef);
      
      if (!matchSnap.exists()) {
        throw new Error('Match not found');
      }
      
      const match = matchSnap.data();
      const playerIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id];
      
      // Get all player refs and documents
      const playerRefs = playerIds.map(id => doc(db, 'players', id));
      const playerSnaps = await Promise.all(playerRefs.map(ref => transaction.get(ref)));
      const players = playerSnaps.map(snap => ({ id: snap.id, ...snap.data() }));
      
      if (players.length !== 4) {
        throw new Error('Could not fetch all 4 players');
      }
      
      // Create map for easy lookup
      const playerMap = players.reduce((acc, player) => {
        acc[player.id as string] = player;
        return acc;
      }, {} as Record<string, any>);
      
      // Initialize new values
      let player1NewPoints = playerMap[match.player1_id].points || 0;
      let player2NewPoints = playerMap[match.player2_id].points || 0;
      let player3NewPoints = playerMap[match.player3_id].points || 0;
      let player4NewPoints = playerMap[match.player4_id].points || 0;
      let player1NewScores = playerMap[match.player1_id].total_scores || 0;
      let player2NewScores = playerMap[match.player2_id].total_scores || 0;
      let player3NewScores = playerMap[match.player3_id].total_scores || 0;
      let player4NewScores = playerMap[match.player4_id].total_scores || 0;
      
      const winnerPoints = 2;
      const loserPoints = 1;
      
      // If editing, subtract previous points and scores
      if (isEdit && match.is_completed) {
        console.log('Editing match - removing previous points and scores');
        
        if (match.score1 > match.score2) {
          player1NewPoints -= winnerPoints;
          player2NewPoints -= winnerPoints;
          player3NewPoints -= loserPoints;
          player4NewPoints -= loserPoints;
          player1NewScores -= match.score1;
          player2NewScores -= match.score1;
          player3NewScores -= match.score2;
          player4NewScores -= match.score2;
        } else {
          player1NewPoints -= loserPoints;
          player2NewPoints -= loserPoints;
          player3NewPoints -= winnerPoints;
          player4NewPoints -= winnerPoints;
          player1NewScores -= match.score1;
          player2NewScores -= match.score1;
          player3NewScores -= match.score2;
          player4NewScores -= match.score2;
        }
      }
      
      // Add new points and scores
      if (score1 > score2) {
        console.log('Team 1 wins');
        player1NewPoints += winnerPoints;
        player2NewPoints += winnerPoints;
        player3NewPoints += loserPoints;
        player4NewPoints += loserPoints;
        player1NewScores += score1;
        player2NewScores += score1;
        player3NewScores += score2;
        player4NewScores += score2;
      } else {
        console.log('Team 2 wins');
        player1NewPoints += loserPoints;
        player2NewPoints += loserPoints;
        player3NewPoints += winnerPoints;
        player4NewPoints += winnerPoints;
        player1NewScores += score1;
        player2NewScores += score1;
        player3NewScores += score2;
        player4NewScores += score2;
      }
      
      // Update all players in transaction
      transaction.update(playerRefs[0], { 
        points: player1NewPoints,
        total_scores: player1NewScores
      });
      transaction.update(playerRefs[1], { 
        points: player2NewPoints,
        total_scores: player2NewScores
      });
      transaction.update(playerRefs[2], { 
        points: player3NewPoints,
        total_scores: player3NewScores
      });
      transaction.update(playerRefs[3], { 
        points: player4NewPoints,
        total_scores: player4NewScores
      });
    });
    
    console.log('Player points updated successfully');
  } catch (error) {
    console.error('Unexpected error in updatePlayerPointsFromMatch:', error);
  }
};

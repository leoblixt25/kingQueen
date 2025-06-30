import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, Match, FinalMatchScores, FinalMatchWinner } from '@/types';

export const useTournamentData = () => {
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>([]);
  const [maleMatches, setMaleMatches] = useState<Match[]>([]);
  const [finalMatchScores, setFinalMatchScores] = useState<FinalMatchScores>({
    team1: [null, null, null],
    team2: [null, null, null],
  });
  const [finalMatchSubmitted, setFinalMatchSubmitted] = useState(false);
  const [finalMatchWinner, setFinalMatchWinner] = useState<FinalMatchWinner>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadTournamentData();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        loadPlayers();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches();
      })
      .subscribe();

    const finalMatchChannel = supabase
      .channel('final-match-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_matches' }, () => {
        loadFinalMatch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(finalMatchChannel);
    };
  }, []);

  const loadTournamentData = async () => {
    setIsLoading(true);
    console.log('Loading tournament data...');
    
    try {
      await Promise.all([loadPlayers(), loadMatches(), loadFinalMatch()]);
    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayers = async () => {
    console.log('Loading players...');
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .order('points', { ascending: false })
      .order('total_scores', { ascending: false });

    if (error) {
      console.error('Error loading players:', error);
      return;
    }

    console.log('Players loaded:', players);

    if (players && players.length > 0) {
      const females = players.filter(p => p.gender === 'female').map(p => ({
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));
      
      const males = players.filter(p => p.gender === 'male').map(p => ({
        name: p.name,
        points: p.points,
        totalScores: p.total_scores
      }));

      console.log('Female players count:', females.length);
      console.log('Male players count:', males.length);

      // Check if we have the wrong number of players and need to reinitialize
      if (females.length !== 8 || males.length !== 8) {
        console.log('Incorrect player count detected. Female:', females.length, 'Male:', males.length, '. Reinitializing...');
        await resetAndInitializePlayers();
        return;
      }

      setFemalePlayers(females);
      setMalePlayers(males);
    } else {
      console.log('No players found, initializing default players...');
      await initializeDefaultPlayers();
    }
  };

  const resetAndInitializePlayers = async () => {
    console.log('Resetting and reinitializing all players...');
    
    try {
      // Delete all existing data in the correct order (foreign key constraints)
      await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      console.log('All existing data cleared');
      
      // Wait a moment for deletions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Initialize fresh players
      await initializeDefaultPlayers();
    } catch (error) {
      console.error('Error in resetAndInitializePlayers:', error);
    }
  };

  const loadMatches = async () => {
    console.log('Loading matches...');
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:players!matches_player1_id_fkey(name),
        player2:players!matches_player2_id_fkey(name),
        player3:players!matches_player3_id_fkey(name),
        player4:players!matches_player4_id_fkey(name)
      `)
      .order('match_order');

    if (error) {
      console.error('Error loading matches:', error);
      return;
    }

    console.log('Matches loaded:', matches);

    if (matches && matches.length > 0) {
      const femaleMatchesData = matches
        .filter(m => m.gender === 'female')
        .map(m => ({
          player1: { name: m.player1?.name || '', points: 0, totalScores: 0 },
          player2: { name: m.player2?.name || '', points: 0, totalScores: 0 },
          player3: { name: m.player3?.name || '', points: 0, totalScores: 0 },
          player4: { name: m.player4?.name || '', points: 0, totalScores: 0 },
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_submitted || false
        }));

      const maleMatchesData = matches
        .filter(m => m.gender === 'male')
        .map(m => ({
          player1: { name: m.player1?.name || '', points: 0, totalScores: 0 },
          player2: { name: m.player2?.name || '', points: 0, totalScores: 0 },
          player3: { name: m.player3?.name || '', points: 0, totalScores: 0 },
          player4: { name: m.player4?.name || '', points: 0, totalScores: 0 },
          score1: m.score1 || 0,
          score2: m.score2 || 0,
          isSubmitted: m.is_submitted || false
        }));

      console.log('Female matches count:', femaleMatchesData.length);
      console.log('Male matches count:', maleMatchesData.length);

      // Check if we have the wrong number of matches and need to reinitialize
      if (femaleMatchesData.length !== 14 || maleMatchesData.length !== 14) {
        console.log('Incorrect match count detected. Female:', femaleMatchesData.length, 'Male:', maleMatchesData.length, '. Reinitializing...');
        await resetAndInitializePlayers();
        return;
      }

      setFemaleMatches(femaleMatchesData);
      setMaleMatches(maleMatchesData);
    } else {
      console.log('No matches found, will initialize after players are created');
    }
  };

  const loadFinalMatch = async () => {
    console.log('Loading final match...');
    const { data: finalMatch, error } = await supabase
      .from('final_matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading final match:', error);
      return;
    }

    if (finalMatch) {
      setFinalMatchScores({
        team1: [finalMatch.team1_set1, finalMatch.team1_set2, finalMatch.team1_set3],
        team2: [finalMatch.team2_set1, finalMatch.team2_set2, finalMatch.team2_set3],
      });
      setFinalMatchSubmitted(finalMatch.is_submitted);
      
      if (finalMatch.winner_team) {
        setFinalMatchWinner({
          team: finalMatch.winner_team as 'team1' | 'team2',
          malePlayer: finalMatch.male_winner || '',
          femalePlayer: finalMatch.female_winner || '',
          losingMalePlayer: finalMatch.male_runner_up || '',
          losingFemalePlayer: finalMatch.female_runner_up || ''
        });
      }
    }
  };

  const initializeDefaultPlayers = async () => {
    console.log('Initializing default players...');
    const defaultFemalePlayers = [
      "Lakota", "Lidia", "Giulia", "Dina", "Catalina", "Izel", "Marta", "Eli"
    ];
    
    const defaultMalePlayers = [
      "Giacomo", "David", "Javi", "Mauro", "Mattia", "Dani", "Leo", "Samuel"
    ];

    try {
      // Check if players already exist to prevent duplicates
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('name, gender');

      if (existingPlayers && existingPlayers.length > 0) {
        console.log('Players already exist, skipping initialization');
        return;
      }

      // Insert female players
      const femaleInserts = defaultFemalePlayers.map(name => ({
        name,
        gender: 'female',
        points: 0,
        total_scores: 0
      }));

      const { error: femaleError } = await supabase
        .from('players')
        .insert(femaleInserts);

      if (femaleError) {
        console.error('Error inserting female players:', femaleError);
        return;
      }

      // Insert male players
      const maleInserts = defaultMalePlayers.map(name => ({
        name,
        gender: 'male',
        points: 0,
        total_scores: 0
      }));

      const { error: maleError } = await supabase
        .from('players')
        .insert(maleInserts);

      if (maleError) {
        console.error('Error inserting male players:', maleError);
        return;
      }

      console.log('Default players inserted successfully');
      
      // Wait a moment for insertions to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload players and then initialize matches
      await loadPlayers();
      await initializeMatches();
      
    } catch (error) {
      console.error('Error in initializeDefaultPlayers:', error);
    }
  };

  const initializeMatches = async () => {
    console.log('Initializing matches...');
    
    // Get players to create matches
    const { data: players, error } = await supabase.from('players').select('*');
    if (error || !players) {
      console.error('Error fetching players for match initialization:', error);
      return;
    }

    console.log('Players for match initialization:', players);

    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');

    console.log('Female players for matches:', femalePlayers.length);
    console.log('Male players for matches:', malePlayers.length);

    if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
      console.error('Incorrect number of players for match creation. Female:', femalePlayers.length, 'Male:', malePlayers.length);
      return;
    }

    // Check if matches already exist to prevent duplicates
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id');

    if (existingMatches && existingMatches.length > 0) {
      console.log('Matches already exist, skipping initialization');
      return;
    }

    // Define match combinations (exactly 14 matches)
    const matchCombinations = [
      [0, 1, 2, 3], [4, 5, 6, 7], [5, 6, 7, 0], [3, 4, 1, 2],
      [6, 3, 4, 1], [0, 2, 7, 5], [2, 4, 3, 7], [1, 6, 5, 0],
      [5, 3, 6, 2], [7, 1, 0, 4], [2, 7, 1, 5], [3, 0, 4, 6],
      [7, 4, 0, 6], [5, 2, 6, 1]
    ];

    try {
      // Create female matches
      const femaleMatches = matchCombinations.map((combination, index) => {
        const [p1, p2, p3, p4] = combination;
        return {
          player1_id: femalePlayers[p1].id,
          player2_id: femalePlayers[p2].id,
          player3_id: femalePlayers[p3].id,
          player4_id: femalePlayers[p4].id,
          gender: 'female',
          match_order: index,
          score1: 0,
          score2: 0,
          is_submitted: false
        };
      });

      const { error: femaleMatchError } = await supabase
        .from('matches')
        .insert(femaleMatches);

      if (femaleMatchError) {
        console.error('Error inserting female matches:', femaleMatchError);
        return;
      }

      // Create male matches
      const maleMatches = matchCombinations.map((combination, index) => {
        const [p1, p2, p3, p4] = combination;
        return {
          player1_id: malePlayers[p1].id,
          player2_id: malePlayers[p2].id,
          player3_id: malePlayers[p3].id,
          player4_id: malePlayers[p4].id,
          gender: 'male',
          match_order: index,
          score1: 0,
          score2: 0,
          is_submitted: false
        };
      });

      const { error: maleMatchError } = await supabase
        .from('matches')
        .insert(maleMatches);

      if (maleMatchError) {
        console.error('Error inserting male matches:', maleMatchError);
        return;
      }

      console.log('Matches initialized successfully - 14 female and 14 male matches');
      await loadMatches();
      
    } catch (error) {
      console.error('Error in initializeMatches:', error);
    }
  };

  const updateMatchScore = async (matchIndex: number, score1: number, score2: number, gender: 'male' | 'female') => {
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .eq('gender', gender)
      .order('match_order');

    if (!matches || matchIndex >= matches.length) return;

    const matchId = matches[matchIndex].id;

    const { error } = await supabase
      .from('matches')
      .update({
        score1,
        score2,
        is_submitted: true
      })
      .eq('id', matchId);

    if (error) {
      console.error('Error updating match:', error);
      return;
    }

    // Update player points
    await updatePlayerPointsFromMatch(matchId, score1, score2);
  };

  const updatePlayerPointsFromMatch = async (matchId: string, score1: number, score2: number) => {
    const { data: match } = await supabase
      .from('matches')
      .select('player1_id, player2_id, player3_id, player4_id')
      .eq('id', matchId)
      .single();

    if (!match) return;

    const winnerPoints = 2;
    const loserPoints = 1;

    // Get current player data to calculate new values
    const { data: player1 } = await supabase.from('players').select('points, total_scores').eq('id', match.player1_id).single();
    const { data: player2 } = await supabase.from('players').select('points, total_scores').eq('id', match.player2_id).single();
    const { data: player3 } = await supabase.from('players').select('points, total_scores').eq('id', match.player3_id).single();
    const { data: player4 } = await supabase.from('players').select('points, total_scores').eq('id', match.player4_id).single();

    if (score1 > score2) {
      // Team 1 wins
      if (player1) {
        await supabase
          .from('players')
          .update({ 
            points: player1.points + winnerPoints,
            total_scores: player1.total_scores + score1
          })
          .eq('id', match.player1_id);
      }
      
      if (player2) {
        await supabase
          .from('players')
          .update({ 
            points: player2.points + winnerPoints,
            total_scores: player2.total_scores + score1
          })
          .eq('id', match.player2_id);
      }
      
      if (player3) {
        await supabase
          .from('players')
          .update({ 
            points: player3.points + loserPoints,
            total_scores: player3.total_scores + score2
          })
          .eq('id', match.player3_id);
      }
      
      if (player4) {
        await supabase
          .from('players')
          .update({ 
            points: player4.points + loserPoints,
            total_scores: player4.total_scores + score2
          })
          .eq('id', match.player4_id);
      }
    } else {
      // Team 2 wins
      if (player1) {
        await supabase
          .from('players')
          .update({ 
            points: player1.points + loserPoints,
            total_scores: player1.total_scores + score1
          })
          .eq('id', match.player1_id);
      }
      
      if (player2) {
        await supabase
          .from('players')
          .update({ 
            points: player2.points + loserPoints,
            total_scores: player2.total_scores + score1
          })
          .eq('id', match.player2_id);
      }
      
      if (player3) {
        await supabase
          .from('players')
          .update({ 
            points: player3.points + winnerPoints,
            total_scores: player3.total_scores + score2
          })
          .eq('id', match.player3_id);
      }
      
      if (player4) {
        await supabase
          .from('players')
          .update({ 
            points: player4.points + winnerPoints,
            total_scores: player4.total_scores + score2
          })
          .eq('id', match.player4_id);
      }
    }
  };

  const updateFinalMatch = async (scores: FinalMatchScores) => {
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

  const resetAllData = async () => {
    // Delete all data in the correct order
    await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Wait for deletions to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize
    await initializeDefaultPlayers();
  };

  return {
    femalePlayers,
    malePlayers,
    femaleMatches,
    maleMatches,
    finalMatchScores,
    finalMatchSubmitted,
    finalMatchWinner,
    isLoading,
    updateMatchScore,
    updateFinalMatch,
    resetAllData,
    setFinalMatchScores
  };
};

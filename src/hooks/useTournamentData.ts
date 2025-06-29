
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
    await Promise.all([loadPlayers(), loadMatches(), loadFinalMatch()]);
    setIsLoading(false);
  };

  const loadPlayers = async () => {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .order('points', { ascending: false })
      .order('total_scores', { ascending: false });

    if (error) {
      console.error('Error loading players:', error);
      return;
    }

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

      setFemalePlayers(females);
      setMalePlayers(males);
    } else {
      // Initialize with default players if none exist
      await initializeDefaultPlayers();
    }
  };

  const loadMatches = async () => {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:player1_id(name),
        player2:player2_id(name),
        player3:player3_id(name),
        player4:player4_id(name)
      `)
      .order('match_order');

    if (error) {
      console.error('Error loading matches:', error);
      return;
    }

    if (matches && matches.length > 0) {
      const femaleMatchesData = matches
        .filter(m => m.gender === 'female')
        .map(m => ({
          player1: { name: m.player1.name, points: 0, totalScores: 0 },
          player2: { name: m.player2.name, points: 0, totalScores: 0 },
          player3: { name: m.player3.name, points: 0, totalScores: 0 },
          player4: { name: m.player4.name, points: 0, totalScores: 0 },
          score1: m.score1,
          score2: m.score2,
          isSubmitted: m.is_submitted
        }));

      const maleMatchesData = matches
        .filter(m => m.gender === 'male')
        .map(m => ({
          player1: { name: m.player1.name, points: 0, totalScores: 0 },
          player2: { name: m.player2.name, points: 0, totalScores: 0 },
          player3: { name: m.player3.name, points: 0, totalScores: 0 },
          player4: { name: m.player4.name, points: 0, totalScores: 0 },
          score1: m.score1,
          score2: m.score2,
          isSubmitted: m.is_submitted
        }));

      setFemaleMatches(femaleMatchesData);
      setMaleMatches(maleMatchesData);
    }
  };

  const loadFinalMatch = async () => {
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
    const defaultFemalePlayers = [
      "Lakota", "Lidia", "Giulia", "Dina", "Catalina", "Izel", "Marta", "Eli"
    ];
    
    const defaultMalePlayers = [
      "Giacomo", "David", "Javi", "Mauro", "Mattia", "Dani", "Leo", "Samuel"
    ];

    // Insert female players
    for (const name of defaultFemalePlayers) {
      await supabase.from('players').insert({
        name,
        gender: 'female',
        points: 0,
        total_scores: 0
      });
    }

    // Insert male players
    for (const name of defaultMalePlayers) {
      await supabase.from('players').insert({
        name,
        gender: 'male',
        points: 0,
        total_scores: 0
      });
    }

    // Reload players after initialization
    await loadPlayers();
    await initializeMatches();
  };

  const initializeMatches = async () => {
    // Get players to create matches
    const { data: players } = await supabase.from('players').select('*');
    if (!players) return;

    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');

    // Define match combinations (same as in the original code)
    const matchCombinations = [
      [0, 1, 2, 3], [4, 5, 6, 7], [5, 6, 7, 0], [3, 4, 1, 2],
      [6, 3, 4, 1], [0, 2, 7, 5], [2, 4, 3, 7], [1, 6, 5, 0],
      [5, 3, 6, 2], [7, 1, 0, 4], [2, 7, 1, 5], [3, 0, 4, 6],
      [7, 4, 0, 6], [5, 2, 6, 1]
    ];

    // Create female matches
    for (let i = 0; i < matchCombinations.length; i++) {
      const [p1, p2, p3, p4] = matchCombinations[i];
      await supabase.from('matches').insert({
        player1_id: femalePlayers[p1].id,
        player2_id: femalePlayers[p2].id,
        player3_id: femalePlayers[p3].id,
        player4_id: femalePlayers[p4].id,
        gender: 'female',
        match_order: i
      });
    }

    // Create male matches
    for (let i = 0; i < matchCombinations.length; i++) {
      const [p1, p2, p3, p4] = matchCombinations[i];
      await supabase.from('matches').insert({
        player1_id: malePlayers[p1].id,
        player2_id: malePlayers[p2].id,
        player3_id: malePlayers[p3].id,
        player4_id: malePlayers[p4].id,
        gender: 'male',
        match_order: i
      });
    }

    await loadMatches();
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

    if (score1 > score2) {
      // Team 1 wins - update points directly
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [winnerPoints]),
          total_scores: supabase.raw('total_scores + ?', [score1])
        })
        .eq('id', match.player1_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [winnerPoints]),
          total_scores: supabase.raw('total_scores + ?', [score1])
        })
        .eq('id', match.player2_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [loserPoints]),
          total_scores: supabase.raw('total_scores + ?', [score2])
        })
        .eq('id', match.player3_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [loserPoints]),
          total_scores: supabase.raw('total_scores + ?', [score2])
        })
        .eq('id', match.player4_id);
    } else {
      // Team 2 wins
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [loserPoints]),
          total_scores: supabase.raw('total_scores + ?', [score1])
        })
        .eq('id', match.player1_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [loserPoints]),
          total_scores: supabase.raw('total_scores + ?', [score1])
        })
        .eq('id', match.player2_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [winnerPoints]),
          total_scores: supabase.raw('total_scores + ?', [score2])
        })
        .eq('id', match.player3_id);
        
      await supabase
        .from('players')
        .update({ 
          points: supabase.raw('points + ?', [winnerPoints]),
          total_scores: supabase.raw('total_scores + ?', [score2])
        })
        .eq('id', match.player4_id);
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
    // Delete all data
    await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
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

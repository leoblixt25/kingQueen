
import { useState, useEffect } from "react";
import { Match, Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useVolleyballData() {
  const { toast } = useToast();
  const [gender, setGender] = useState<Gender>("female");
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>([]);
  const [maleMatches, setMaleMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  const players = gender === 'female' ? femalePlayers : malePlayers;
  const matches = gender === 'female' ? femaleMatches : maleMatches;
  const setMatches = gender === 'female' ? setFemaleMatches : setMaleMatches;
  const setPlayers = gender === 'female' ? setFemalePlayers : setMalePlayers;

  useEffect(() => {
    const loadPlayers = async () => {
      const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        toast({
          title: "Error loading players",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const femalePlayersData = players
        .filter(p => p.gender === 'female')
        .map(p => ({ 
          id: p.id, 
          name: p.name, 
          points: p.points || 0, 
          totalScores: p.total_scores || 0, 
          gender: 'female' as Gender 
        }))
        .sort((a, b) => {
          if (b.points === a.points) {
            return b.totalScores - a.totalScores;
          }
          return b.points - a.points;
        });

      const malePlayersData = players
        .filter(p => p.gender === 'male')
        .map(p => ({ 
          id: p.id, 
          name: p.name, 
          points: p.points || 0, 
          totalScores: p.total_scores || 0, 
          gender: 'male' as Gender 
        }))
        .sort((a, b) => {
          if (b.points === a.points) {
            return b.totalScores - a.totalScores;
          }
          return b.points - a.points;
        });

      setFemalePlayers(femalePlayersData);
      setMalePlayers(malePlayersData);

      // Load matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: true });

      if (matchesError) {
        toast({
          title: "Error loading matches",
          description: matchesError.message,
          variant: "destructive",
        });
        return;
      }

      if (matchesData) {
        const femaleMatches: Match[] = [];
        const maleMatches: Match[] = [];

        matchesData.forEach(match => {
          const player1 = femalePlayersData.find(p => p.id === match.player1_id) || malePlayersData.find(p => p.id === match.player1_id);
          const player2 = femalePlayersData.find(p => p.id === match.player2_id) || malePlayersData.find(p => p.id === match.player2_id);
          const player3 = femalePlayersData.find(p => p.id === match.player3_id) || malePlayersData.find(p => p.id === match.player3_id);
          const player4 = femalePlayersData.find(p => p.id === match.player4_id) || malePlayersData.find(p => p.id === match.player4_id);

          if (player1 && player2 && player3 && player4) {
            const matchObj: Match = {
              player1,
              player2,
              player3,
              player4,
              score1: match.score1 || 0,
              score2: match.score2 || 0,
              isSubmitted: match.is_submitted || false
            };

            if (player1.gender === 'female') {
              femaleMatches.push(matchObj);
            } else {
              maleMatches.push(matchObj);
            }
          }
        });

        setFemaleMatches(femaleMatches);
        setMaleMatches(maleMatches);
        
        // If no matches were loaded, generate initial matches
        if (femaleMatches.length === 0 && femalePlayersData.length >= 4) {
          createInitialMatches('female', femalePlayersData);
        }
        
        if (maleMatches.length === 0 && malePlayersData.length >= 4) {
          createInitialMatches('male', malePlayersData);
        }
      }
    };

    loadPlayers();

    const playersChannel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
    };
  }, []);

  const createInitialMatches = (currentGender: Gender, playersList: Player[]) => {
    if (playersList.length < 4) return;
    
    const initialMatches: Match[] = [];
    const numMatches = 14; // Default to 14 matches as requested
    
    // Generate matches using a round-robin approach
    for (let i = 0; i < numMatches; i++) {
      // Each match needs 4 unique players
      // We'll rotate the players to create fair matchups
      const idx1 = i % playersList.length;
      const idx2 = (i + 1) % playersList.length;
      const idx3 = (i + 2) % playersList.length;
      const idx4 = (i + 3) % playersList.length;
      
      const match: Match = {
        player1: playersList[idx1],
        player2: playersList[idx2],
        player3: playersList[idx3],
        player4: playersList[idx4],
        score1: 0,
        score2: 0,
        isSubmitted: false
      };
      
      initialMatches.push(match);
    }
    
    if (currentGender === 'female') {
      setFemaleMatches(initialMatches);
    } else {
      setMaleMatches(initialMatches);
    }
  };

  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender);
    setCurrentMatchIndex(0);
    setScore1("");
    setScore2("");
  };

  const handlePreviousMatch = () => {
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1);
    }
  };

  const handleNextMatch = () => {
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    }
  };

  const updatePlayerPoints = async (match: Match, scoreValues?: { score1: string, score2: string }) => {
    const score1Num = scoreValues 
      ? parseInt(scoreValues.score1, 10) || 0 
      : match.score1;
    const score2Num = scoreValues 
      ? parseInt(scoreValues.score2, 10) || 0 
      : match.score2;

    const updates = [];
    
    if (score1Num > score2Num) {
      updates.push(
        { id: match.player1.id, points: (match.player1.points || 0) + 2, total_scores: (match.player1.totalScores || 0) + score1Num },
        { id: match.player2.id, points: (match.player2.points || 0) + 2, total_scores: (match.player2.totalScores || 0) + score1Num },
        { id: match.player3.id, points: (match.player3.points || 0) + 1, total_scores: (match.player3.totalScores || 0) + score2Num },
        { id: match.player4.id, points: (match.player4.points || 0) + 1, total_scores: (match.player4.totalScores || 0) + score2Num }
      );
    } else {
      updates.push(
        { id: match.player1.id, points: (match.player1.points || 0) + 1, total_scores: (match.player1.totalScores || 0) + score1Num },
        { id: match.player2.id, points: (match.player2.points || 0) + 1, total_scores: (match.player2.totalScores || 0) + score1Num },
        { id: match.player3.id, points: (match.player3.points || 0) + 2, total_scores: (match.player3.totalScores || 0) + score2Num },
        { id: match.player4.id, points: (match.player4.points || 0) + 2, total_scores: (match.player4.totalScores || 0) + score2Num }
      );
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('players')
        .update({ points: update.points, total_scores: update.total_scores })
        .eq('id', update.id);

      if (error) {
        toast({
          title: "Error updating player points",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    const updatedPlayers = players.map(player => {
      const update = updates.find(u => u.id === player.id);
      if (update) {
        return {
          ...player,
          points: update.points,
          totalScores: update.total_scores
        };
      }
      return player;
    }).sort((a, b) => {
      if (b.points === a.points) {
        return b.totalScores - a.totalScores;
      }
      return b.points - a.points;
    });

    setPlayers(updatedPlayers);
  };

  return {
    gender,
    setGender,
    players,
    femalePlayers,
    malePlayers,
    matches,
    femaleMatches,
    maleMatches,
    setMatches,
    setPlayers,
    createInitialMatches,
    handleGenderChange,
    currentMatchIndex,
    setCurrentMatchIndex,
    score1,
    setScore1,
    score2,
    setScore2,
    handlePreviousMatch,
    handleNextMatch,
    updatePlayerPoints
  };
}

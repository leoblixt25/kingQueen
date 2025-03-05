
import { useState, useEffect } from "react";
import { Match, Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlayersData } from "./usePlayersData";
import { useMatchNavigation } from "./useMatchNavigation";
import { useCreateMatches } from "./useCreateMatches";

export function useVolleyballData() {
  const { toast } = useToast();
  const [gender, setGender] = useState<Gender>("female");
  const { femalePlayers, malePlayers, setFemalePlayers, setMalePlayers, updatePlayerPoints } = usePlayersData();
  const [femaleMatches, setFemaleMatches] = useState<Match[]>([]);
  const [maleMatches, setMaleMatches] = useState<Match[]>([]);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  
  const { currentMatchIndex, setCurrentMatchIndex, isNavigating, handlePreviousMatch, handleNextMatch } = useMatchNavigation();
  const { createInitialMatches } = useCreateMatches();

  const players = gender === 'female' ? femalePlayers : malePlayers;
  const matches = gender === 'female' ? femaleMatches : maleMatches;
  const setMatches = gender === 'female' ? setFemaleMatches : setMaleMatches;
  const setPlayers = gender === 'female' ? setFemalePlayers : setMalePlayers;

  useEffect(() => {
    const loadMatches = async () => {
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
        const femaleMatchesArray: Match[] = [];
        const maleMatchesArray: Match[] = [];

        matchesData.forEach(match => {
          const player1 = femalePlayers.find(p => p.id === match.player1_id) || malePlayers.find(p => p.id === match.player1_id);
          const player2 = femalePlayers.find(p => p.id === match.player2_id) || malePlayers.find(p => p.id === match.player2_id);
          const player3 = femalePlayers.find(p => p.id === match.player3_id) || malePlayers.find(p => p.id === match.player3_id);
          const player4 = femalePlayers.find(p => p.id === match.player4_id) || malePlayers.find(p => p.id === match.player4_id);

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
              femaleMatchesArray.push(matchObj);
            } else {
              maleMatchesArray.push(matchObj);
            }
          }
        });

        setFemaleMatches(femaleMatchesArray);
        setMaleMatches(maleMatchesArray);
        
        if (femaleMatchesArray.length === 0 && femalePlayers.length >= 4) {
          const newMatches = createInitialMatches('female', femalePlayers);
          setFemaleMatches(newMatches);
        }
        
        if (maleMatchesArray.length === 0 && malePlayers.length >= 4) {
          const newMatches = createInitialMatches('male', malePlayers);
          setMaleMatches(newMatches);
        }
      }
    };

    if (femalePlayers.length > 0 || malePlayers.length > 0) {
      loadMatches();
    }
  }, [femalePlayers, malePlayers, toast]);

  useEffect(() => {
    if (matches && matches.length > 0) {
      if (currentMatchIndex >= matches.length) {
        console.log(`Index correction: currentMatchIndex (${currentMatchIndex}) is out of bounds, setting to ${matches.length - 1}`);
        setCurrentMatchIndex(matches.length - 1);
      } else {
        console.log(`Index check: currentMatchIndex (${currentMatchIndex}) is valid, max index is ${matches.length - 1}`);
      }
    } else if (matches && matches.length === 0) {
      console.log("Index correction: No matches available, resetting to index 0");
      setCurrentMatchIndex(0);
    }
  }, [matches, currentMatchIndex, setCurrentMatchIndex]);

  useEffect(() => {
    if (matches) {
      console.log(`Gender ${gender} selected with ${matches.length} matches available`);
    }
  }, [gender, matches]);

  const handleGenderChange = (newGender: Gender) => {
    console.log(`Changing gender from ${gender} to ${newGender}`);
    setGender(newGender);
    setCurrentMatchIndex(0);
  };

  const updatePlayerPointsWrapper = async (match: Match, scoreValues?: { score1: string, score2: string }) => {
    const updates = await updatePlayerPoints(match, scoreValues);
    
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
    createInitialMatches: (g: Gender, p: Player[]) => {
      const newMatches = createInitialMatches(g, p);
      if (g === 'female') {
        setFemaleMatches(newMatches);
      } else {
        setMaleMatches(newMatches);
      }
    },
    handleGenderChange,
    currentMatchIndex,
    setCurrentMatchIndex,
    score1,
    setScore1,
    score2,
    setScore2,
    handlePreviousMatch: () => handlePreviousMatch(matches),
    handleNextMatch: () => handleNextMatch(matches),
    updatePlayerPoints: updatePlayerPointsWrapper
  };
}

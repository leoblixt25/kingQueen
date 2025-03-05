
import { useState, useEffect } from "react";
import { Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePlayersData() {
  const { toast } = useToast();
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);

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
  }, [toast]);

  const updatePlayerPoints = async (match, scoreValues) => {
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

    return updates;
  };

  return {
    femalePlayers,
    malePlayers,
    setFemalePlayers,
    setMalePlayers,
    updatePlayerPoints
  };
}


import { useState } from "react";
import { Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UsePlayerManagementProps {
  players: Player[];
  setPlayers: (players: Player[]) => void;
  gender: Gender;
  matches: any[];
  setMatches: (matches: any[]) => void;
  createInitialMatches: (gender: Gender, players: Player[]) => void;
}

export function usePlayerManagement({
  players,
  setPlayers,
  gender,
  matches,
  setMatches,
  createInitialMatches
}: UsePlayerManagementProps) {
  const { toast } = useToast();
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [replacementName, setReplacementName] = useState("");

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    
    const { data: newPlayerData, error } = await supabase
      .from('players')
      .insert({
        name: newPlayerName,
        gender: gender,
        points: 0,
        total_scores: 0
      })
      .select()
      .single();
      
    if (error) {
      toast({
        title: "Error adding player",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    const newPlayer: Player = {
      id: newPlayerData.id,
      name: newPlayerName,
      points: 0,
      totalScores: 0,
      gender: gender,
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    setNewPlayerName("");
    
    if (updatedPlayers.length >= 4 && matches.length === 0) {
      createInitialMatches(gender, updatedPlayers);
    }
  };

  const handleRemovePlayer = async (playerToRemove: Player) => {
    if (!playerToRemove.id) {
      toast({
        title: "Error removing player",
        description: "Player ID is missing",
        variant: "destructive",
      });
      return;
    }
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerToRemove.id);
      
    if (error) {
      toast({
        title: "Error removing player",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const updatedPlayers = players.filter(p => p.name !== playerToRemove.name);
    setPlayers(updatedPlayers);

    const updatedMatches = matches.filter(match => 
      match.player1.name !== playerToRemove.name &&
      match.player2.name !== playerToRemove.name &&
      match.player3.name !== playerToRemove.name &&
      match.player4.name !== playerToRemove.name
    );
    setMatches(updatedMatches);
  };

  const handleReplacePlayer = async () => {
    if (!selectedPlayer || !replacementName.trim() || !selectedPlayer.id) return;

    const { error } = await supabase
      .from('players')
      .update({ name: replacementName })
      .eq('id', selectedPlayer.id);
      
    if (error) {
      toast({
        title: "Error replacing player",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const newPlayer: Player = {
      id: selectedPlayer.id,
      name: replacementName,
      points: selectedPlayer.points,
      totalScores: selectedPlayer.totalScores,
      gender: gender,
    };

    const updatedPlayers = players.map(p => 
      p.name === selectedPlayer.name ? newPlayer : p
    );
    setPlayers(updatedPlayers);

    const updatedMatches = matches.map(match => ({
      ...match,
      player1: match.player1.name === selectedPlayer.name ? newPlayer : match.player1,
      player2: match.player2.name === selectedPlayer.name ? newPlayer : match.player2,
      player3: match.player3.name === selectedPlayer.name ? newPlayer : match.player3,
      player4: match.player4.name === selectedPlayer.name ? newPlayer : match.player4,
    }));
    setMatches(updatedMatches);

    setSelectedPlayer(null);
    setReplacementName("");
    
    toast({
      title: "Success",
      description: `Replaced player ${selectedPlayer.name} with ${replacementName}`,
    });
  };

  return {
    showPlayerManagement,
    setShowPlayerManagement,
    newPlayerName,
    setNewPlayerName,
    selectedPlayer,
    setSelectedPlayer,
    replacementName,
    setReplacementName,
    handleAddPlayer,
    handleRemovePlayer,
    handleReplacePlayer
  };
}

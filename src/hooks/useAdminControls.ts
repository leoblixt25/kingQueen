
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Gender, Player } from "@/types";

interface UseAdminControlsProps {
  gender: Gender;
  players: Player[];
  matches: any[];
  setPlayers: (players: Player[]) => void;
  createInitialMatches: (gender: Gender, players: Player[]) => void;
  setCurrentMatchIndex: (index: number) => void;
}

export function useAdminControls({
  gender,
  players,
  matches,
  setPlayers,
  createInitialMatches,
  setCurrentMatchIndex
}: UseAdminControlsProps) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLoginForm, setShowLoginForm] = useState(false);

  const handleAdminLogin = () => {
    if (adminUsername === 'leo' && adminPassword === 'Woodgoat22!!') {
      setIsAdmin(true);
      setShowLoginForm(false);
    } else {
      alert('Invalid username or password');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
  };

  const handleResetScores = async () => {
    if (!isAdmin) return;

    const { error: resetError } = await supabase
      .from('players')
      .update({ points: 0, total_scores: 0 })
      .eq('gender', gender);

    if (resetError) {
      toast({
        title: "Error resetting scores",
        description: resetError.message,
        variant: "destructive",
      });
      return;
    }

    for (const match of matches) {
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('player1_id', match.player1.id);
        
      if (matchError) {
        console.error("Error deleting match:", matchError);
      }
    }

    const resetPlayers = players.map(player => ({ 
      ...player, 
      points: 0, 
      totalScores: 0 
    }));
    
    setPlayers(resetPlayers);
    createInitialMatches(gender, resetPlayers);
    setCurrentMatchIndex(0);

    toast({
      title: "Success",
      description: `Reset all scores for ${gender} players and created new matches`,
    });
  };

  return {
    isAdmin,
    setIsAdmin,
    adminUsername,
    setAdminUsername,
    adminPassword,
    setAdminPassword,
    showLoginForm,
    setShowLoginForm,
    handleAdminLogin,
    handleAdminLogout,
    handleResetScores
  };
}

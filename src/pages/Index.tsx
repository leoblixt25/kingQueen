
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gender, Match, Player, FinalMatchScores, FinalMatchWinner } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminLogin } from "@/components/AdminLogin";
import { PlayerManagement } from "@/components/PlayerManagement";
import { FinalMatch } from "@/components/FinalMatch";
import { MatchDisplay } from "@/components/MatchDisplay";
import { Rankings } from "@/components/Rankings";

export default function BeachVolleyballTracker() {
  const { toast } = useToast();
  const [gender, setGender] = useState<Gender>("female");
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>([]);
  const [maleMatches, setMaleMatches] = useState<Match[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [finalMatchScores, setFinalMatchScores] = useState<FinalMatchScores>({
    team1: [null, null, null],
    team2: [null, null, null],
  });
  const [finalMatchSubmitted, setFinalMatchSubmitted] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showFinalMatch, setShowFinalMatch] = useState(false);
  const [isEditingFinalMatch, setIsEditingFinalMatch] = useState(false);
  const [finalMatchWinner, setFinalMatchWinner] = useState<FinalMatchWinner>(null);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>("female");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [replacementName, setReplacementName] = useState("");

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

  // Function to create initial matchups
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
    setShowFinalMatch(false);
    setCurrentMatchIndex(0);
    setScore1("");
    setScore2("");
  };

  const handleScoreSubmit = async () => {
    if (!matches || !matches[currentMatchIndex]) {
      toast({
        title: "Error",
        description: "No match available to submit scores for",
        variant: "destructive",
      });
      return;
    }

    const currentMatch = matches[currentMatchIndex];
    const scoreData = {
      player1_id: currentMatch.player1.id,
      player2_id: currentMatch.player2.id,
      player3_id: currentMatch.player3.id,
      player4_id: currentMatch.player4.id,
      score1: parseInt(score1, 10) || 0,
      score2: parseInt(score2, 10) || 0,
      is_submitted: true
    };

    const { error } = await supabase
      .from('matches')
      .insert(scoreData);

    if (error) {
      toast({
        title: "Error saving match",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const parseScore1 = parseInt(score1, 10) || 0;
    const parseScore2 = parseInt(score2, 10) || 0;
    
    const newMatches = [...matches];
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseScore1,
      score2: parseScore2,
      isSubmitted: true,
    };
    setMatches(newMatches);
    
    // Update player points with current scores
    const scoreValuesForUpdate = {
      score1: parseScore1.toString(),
      score2: parseScore2.toString()
    };
    await updatePlayerPoints(newMatches[currentMatchIndex], scoreValuesForUpdate);
    
    // Reset input fields but don't navigate yet
    setScore1("");
    setScore2("");
    
    toast({
      title: "Score submitted",
      description: `Match ${currentMatchIndex + 1} score recorded: ${parseScore1} - ${parseScore2}`,
    });
    
    // Create next match if we're at the end and there are enough players
    if (currentMatchIndex === matches.length - 1 && players.length >= 4) {
      const nextMatch: Match = {
        player1: players[0],
        player2: players[1],
        player3: players[2],
        player4: players[3],
        score1: 0,
        score2: 0,
        isSubmitted: false
      };
      setMatches([...newMatches, nextMatch]);
    }
    
    // Automatically advance to next match if available
    if (currentMatchIndex < matches.length - 1) {
      handleNextMatch();
    }
  };

  const updatePlayerPoints = async (match: Match, scoreValues?: { score1: string, score2: string }) => {
    // Use either provided scoreValues or get from match
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

    // Update local state after all updates are done
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

  const handleAdminLogin = () => {
    if (adminUsername === 'leo' && adminPassword === 'Woodgoat22!!') {
      setIsAdmin(true)
      setShowLoginForm(false)
    } else {
      alert('Invalid username or password')
    }
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
  }

  const handleResetScores = async () => {
    if (!isAdmin) return;

    // Reset player scores in the database
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

    // Clear match data in the database
    // Delete all matches for the current gender
    for (const match of matches) {
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('player1_id', match.player1.id);
        
      if (matchError) {
        console.error("Error deleting match:", matchError);
      }
    }

    // Reset local player state
    if (gender === 'female') {
      const resetFemalePlayers = femalePlayers.map(player => ({ 
        ...player, 
        points: 0, 
        totalScores: 0 
      }));
      setFemalePlayers(resetFemalePlayers);
      
      // Create new set of matches after resetting
      createInitialMatches('female', resetFemalePlayers);
    } else {
      const resetMalePlayers = malePlayers.map(player => ({ 
        ...player, 
        points: 0, 
        totalScores: 0 
      }));
      setMalePlayers(resetMalePlayers);
      
      // Create new set of matches after resetting
      createInitialMatches('male', resetMalePlayers);
    }
    
    // Reset to the first match
    setCurrentMatchIndex(0);

    toast({
      title: "Success",
      description: `Reset all scores for ${gender} players and created new matches`,
    });
  };

  const handleEditScore = (matchIndex: number, newScore1: number, newScore2: number) => {
    const newMatches = [...matches]
    const oldMatch = newMatches[matchIndex]
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    }

    const oldPlayers = [...players]
    const oldPlayer1Index = oldPlayers.findIndex(p => p.name === oldMatch.player1.name)
    const oldPlayer2Index = oldPlayers.findIndex(p => p.name === oldMatch.player2.name)
    const oldPlayer3Index = oldPlayers.findIndex(p => p.name === oldMatch.player3.name)
    const oldPlayer4Index = oldPlayers.findIndex(p => p.name === oldMatch.player4.name)

    oldPlayers[oldPlayer1Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer2Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer3Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2
    oldPlayers[oldPlayer4Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2

    oldPlayers[oldPlayer1Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer2Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer3Index].totalScores -= oldMatch.score2
    oldPlayers[oldPlayer4Index].totalScores -= oldMatch.score2

    // Create the scoreValues object for the updatePlayerPoints function
    const scoreValues = {
      score1: newScore1.toString(),
      score2: newScore2.toString()
    };
    
    updatePlayerPoints(newMatches[matchIndex], scoreValues);

    setMatches(newMatches)
    setPlayers(oldPlayers.sort((a, b) => {
      if (b.points === a.points) {
        return b.totalScores - a.totalScores;
      }
      return b.points - a.points;
    }))
  };

  const handleFinalMatchSubmit = () => {
    const team1Scores = finalMatchScores.team1.filter(score => score !== null) as number[]
    const team2Scores = finalMatchScores.team2.filter(score => score !== null) as number[]

    const team1Wins = team1Scores.filter((score, index) => score > (team2Scores[index] || 0)).length
    const team2Wins = team2Scores.filter((score, index) => score > (team1Scores[index] || 0)).length

    if (team1Wins > team2Wins) {
      setFinalMatchWinner({
        team: 'team1',
        malePlayer: malePlayers[0].name,
        femalePlayer: femalePlayers[1].name,
        losingMalePlayer: malePlayers[1].name,
        losingFemalePlayer: femalePlayers[0].name,
      })
    } else if (team2Wins > team1Wins) {
      setFinalMatchWinner({
        team: 'team2',
        malePlayer: malePlayers[1].name,
        femalePlayer: femalePlayers[0].name,
        losingMalePlayer: malePlayers[0].name,
        losingFemalePlayer: femalePlayers[1].name,
      })
    } else {
      setFinalMatchWinner(null)
    }

    setFinalMatchSubmitted(true)
  }

  const handleEditFinalMatch = () => {
    setIsEditingFinalMatch(true)
  }

  const handleFinalMatchEditSubmit = () => {
    setIsEditingFinalMatch(false)
  }

  const handleResetFinalMatch = () => {
    setFinalMatchScores({ team1: [null, null, null], team2: [null, null, null] })
    setFinalMatchSubmitted(false)
    setFinalMatchWinner(null)
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    
    // Create new player in database first
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
    
    // If we now have enough players, and no matches exist, create initial matches
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
    
    // Remove player from database
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

    // Update player in database
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

  const handlePreviousMatch = () => {
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1);
      setScore1('');
      setScore2('');
    }
  };

  const handleNextMatch = () => {
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
      setScore1('');
      setScore2('');
    }
  };

  const currentMatch = matches[currentMatchIndex];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="relative flex flex-col sm:flex-row justify-center items-center gap-4">
            <div className="flex flex-wrap justify-center items-center gap-2">
              <Button 
                variant={gender === 'female' ? "default" : "outline"} 
                onClick={() => handleGenderChange('female')}
                className="w-full sm:w-auto"
              >
                Female
              </Button>
              <Button 
                variant={gender === 'male' ? "default" : "outline"}
                onClick={() => handleGenderChange('male')}
                className="w-full sm:w-auto"
              >
                Male
              </Button>
              <Button 
                variant={showFinalMatch ? "default" : "outline"}
                onClick={() => setShowFinalMatch(true)}
                className="w-full sm:w-auto"
              >
                Final Match
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant={showPlayerManagement ? "default" : "outline"}
                    onClick={() => setShowPlayerManagement(!showPlayerManagement)}
                    className="w-full sm:w-auto"
                  >
                    Manage Players
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetScores}
                    className="w-full sm:w-auto"
                  >
                    Reset Scores
                  </Button>
                </>
              )}
            </div>
            <div className="sm:absolute sm:right-0 sm:top-0">
              {!isAdmin ? (
                <Button 
                  variant="outline" 
                  onClick={() => setShowLoginForm(true)}
                  size="sm"
                  className="text-sm bg-gray-50"
                >
                  Admin Login
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={handleAdminLogout}
                  size="sm"
                >
                  Logout
                </Button>
              )}
            </div>
          </div>
        </header>

        {showLoginForm && (
          <AdminLogin
            adminUsername={adminUsername}
            adminPassword={adminPassword}
            setAdminUsername={setAdminUsername}
            setAdminPassword={setAdminPassword}
            handleAdminLogin={handleAdminLogin}
          />
        )}

        {!showLoginForm && (
          <main>
            {showFinalMatch ? (
              <FinalMatch
                malePlayers={malePlayers}
                femalePlayers={femalePlayers}
                finalMatchScores={finalMatchScores}
                setFinalMatchScores={setFinalMatchScores}
                finalMatchSubmitted={finalMatchSubmitted}
                isEditingFinalMatch={isEditingFinalMatch}
                finalMatchWinner={finalMatchWinner}
                isAdmin={isAdmin}
                handleFinalMatchSubmit={handleFinalMatchSubmit}
                handleEditFinalMatch={handleEditFinalMatch}
                handleResetFinalMatch={handleResetFinalMatch}
                handleFinalMatchEditSubmit={handleFinalMatchEditSubmit}
              />
            ) : (
              <>
                {matches && matches.length > 0 && matches[currentMatchIndex] ? (
                  <MatchDisplay
                    match={matches[currentMatchIndex]}
                    currentMatchIndex={currentMatchIndex}
                    matches={matches}
                    score1={score1}
                    score2={score2}
                    isAdmin={isAdmin}
                    setScore1={setScore1}
                    setScore2={setScore2}
                    handlePreviousMatch={handlePreviousMatch}
                    handleNextMatch={handleNextMatch}
                    handleScoreSubmit={handleScoreSubmit}
                    handleEditScore={handleEditScore}
                  />
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-lg mb-8">
                    <p className="text-lg text-gray-600">No matches available. Add at least 4 players to create matches.</p>
                    {isAdmin && (
                      <Button 
                        onClick={() => setShowPlayerManagement(true)}
                        className="mt-4"
                      >
                        Manage Players
                      </Button>
                    )}
                  </div>
                )}

                <Rankings players={players} />
              </>
            )}
          </main>
        )}

        {!showLoginForm && isAdmin && showPlayerManagement && (
          <PlayerManagement
            players={players}
            newPlayerName={newPlayerName}
            setNewPlayerName={setNewPlayerName}
            handleAddPlayer={handleAddPlayer}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            replacementName={replacementName}
            setReplacementName={setReplacementName}
            handleReplacePlayer={handleReplacePlayer}
            handleRemovePlayer={handleRemovePlayer}
          />
        )}
      </div>
    </div>
  );
}

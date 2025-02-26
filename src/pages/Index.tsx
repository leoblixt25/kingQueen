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

      const femalePlayersData = players.filter(p => p.gender === 'female')
        .map(p => ({ id: p.id, name: p.name, points: p.points, totalScores: p.total_scores, gender: 'female' as Gender }));
      const malePlayersData = players.filter(p => p.gender === 'male')
        .map(p => ({ id: p.id, name: p.name, points: p.points, totalScores: p.total_scores, gender: 'male' as Gender }));

      setFemalePlayers(femalePlayersData);
      setMalePlayers(malePlayersData);

      // Create initial matches if there are enough players
      if (femalePlayersData.length >= 4) {
        const initialFemaleMatch: Match = {
          player1: femalePlayersData[0],
          player2: femalePlayersData[1],
          player3: femalePlayersData[2],
          player4: femalePlayersData[3],
          score1: 0,
          score2: 0,
          isSubmitted: false
        };
        setFemaleMatches([initialFemaleMatch]);
      }

      if (malePlayersData.length >= 4) {
        const initialMaleMatch: Match = {
          player1: malePlayersData[0],
          player2: malePlayersData[1],
          player3: malePlayersData[2],
          player4: malePlayersData[3],
          score1: 0,
          score2: 0,
          isSubmitted: false
        };
        setMaleMatches([initialMaleMatch]);
      }
    };

    loadPlayers();

    const playersChannel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
    };
  }, []);

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

    const newMatches = [...matches];
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseInt(score1, 10) || 0,
      score2: parseInt(score2, 10) || 0,
      isSubmitted: true,
    };
    setMatches(newMatches);
    updatePlayerPoints(newMatches[currentMatchIndex]);
    setScore1('');
    setScore2('');
  };

  const updatePlayerPoints = async (match: Match) => {
    const { player1, player2, player3, player4, score1, score2 } = match;
    const player1Index = players.findIndex(p => p.name === player1.name);
    const player2Index = players.findIndex(p => p.name === player2.name);
    const player3Index = players.findIndex(p => p.name === player3.name);
    const player4Index = players.findIndex(p => p.name === player4.name);

    const updates = [];
    
    if (score1 > score2) {
      updates.push(
        { id: players[player1Index].id, points: players[player1Index].points + 2, total_scores: players[player1Index].totalScores + score1 },
        { id: players[player2Index].id, points: players[player2Index].points + 2, total_scores: players[player2Index].totalScores + score1 },
        { id: players[player3Index].id, points: players[player3Index].points + 1, total_scores: players[player3Index].totalScores + score2 },
        { id: players[player4Index].id, points: players[player4Index].points + 1, total_scores: players[player4Index].totalScores + score2 }
      );
    } else {
      updates.push(
        { id: players[player1Index].id, points: players[player1Index].points + 1, total_scores: players[player1Index].totalScores + score1 },
        { id: players[player2Index].id, points: players[player2Index].points + 1, total_scores: players[player2Index].totalScores + score1 },
        { id: players[player3Index].id, points: players[player3Index].points + 2, total_scores: players[player3Index].totalScores + score2 },
        { id: players[player4Index].id, points: players[player4Index].points + 2, total_scores: players[player4Index].totalScores + score2 }
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
    const { error: resetError } = await supabase
      .from('players')
      .update({ points: 0, total_scores: 0 });

    if (resetError) {
      toast({
        title: "Error resetting scores",
        description: resetError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: matchesError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (matchesError) {
      toast({
        title: "Error resetting matches",
        description: matchesError.message,
        variant: "destructive",
      });
      return;
    }

    const newFemalePlayers = femalePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }));
    setFemalePlayers(newFemalePlayers);
    const newMalePlayers = malePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }));
    setMalePlayers(newMalePlayers);
    setFemaleMatches([]);
    setMaleMatches([]);
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

    updatePlayerPoints(newMatches[matchIndex])

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

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    
    const newPlayer: Player = {
      name: newPlayerName,
      points: 0,
      totalScores: 0,
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    setNewPlayerName("");
  };

  const handleRemovePlayer = (playerToRemove: Player) => {
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

  const handleReplacePlayer = () => {
    if (!selectedPlayer || !replacementName.trim()) return;

    const newPlayer: Player = {
      name: replacementName,
      points: selectedPlayer.points,
      totalScores: selectedPlayer.totalScores,
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
                onClick={() => { setGender('female'); setShowFinalMatch(false); }}
                className="w-full sm:w-auto"
              >
                Female
              </Button>
              <Button 
                variant={gender === 'male' ? "default" : "outline"}
                onClick={() => { setGender('male'); setShowFinalMatch(false); }}
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
                <Button
                  variant={showPlayerManagement ? "default" : "outline"}
                  onClick={() => setShowPlayerManagement(!showPlayerManagement)}
                  className="w-full sm:w-auto"
                >
                  Manage Players
                </Button>
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
                {matches && matches.length > 0 && matches[currentMatchIndex] && (
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

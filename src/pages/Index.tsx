import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash, Crown, UserPlus, UserMinus, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gender, Match, Player, FinalMatchScores, FinalMatchWinner } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
          <Card className="mb-8 max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Admin Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Username</Label>
                <Input
                  id="adminUsername"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                />
              </div>
              <Button onClick={handleAdminLogin} className="w-full">Login</Button>
            </CardContent>
          </Card>
        )}

        {!showLoginForm && (
          <main>
            {showFinalMatch ? (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center mb-4">
                    🏆 Final Match 🏆
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Team 1 */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      <h3 className="text-lg font-semibold text-center sm:min-w-[200px]">
                        Team 1: {malePlayers[0]?.name} & {femalePlayers[1]?.name}
                      </h3>
                      <div className="flex gap-4 justify-center">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team1-set${setIndex + 1}`} className="text-center block">Set {setIndex + 1}</Label>
                            <Input
                              id={`team1-set${setIndex + 1}`}
                              value={finalMatchScores.team1[setIndex] !== null ? finalMatchScores.team1[setIndex] : ''}
                              onChange={(e) => {
                                const newScores = [...finalMatchScores.team1];
                                newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setFinalMatchScores({
                                  ...finalMatchScores,
                                  team1: newScores as [number | null, number | null, number | null]
                                });
                              }}
                              type="number"
                              className="w-16 text-center"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      <h3 className="text-lg font-semibold text-center sm:min-w-[200px]">
                        Team 2: {femalePlayers[0]?.name} & {malePlayers[1]?.name}
                      </h3>
                      <div className="flex gap-4 justify-center">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team2-set${setIndex + 1}`} className="text-center block">Set {setIndex + 1}</Label>
                            <Input
                              id={`team2-set${setIndex + 1}`}
                              value={finalMatchScores.team2[setIndex] !== null ? finalMatchScores.team2[setIndex] : ''}
                              onChange={(e) => {
                                const newScores = [...finalMatchScores.team2];
                                newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setFinalMatchScores({
                                  ...finalMatchScores,
                                  team2: newScores as [number | null, number | null, number | null]
                                });
                              }}
                              type="number"
                              className="w-16 text-center"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {!finalMatchSubmitted ? (
                    <div className="flex justify-center pt-4">
                      <Button onClick={handleFinalMatchSubmit} className="w-full sm:w-auto">
                        Submit Final Match
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 text-center">Final Match Results</h3>
                        <div className="space-y-2 text-center">
                          <p className="text-gray-600">
                            Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                          </p>
                          <p className="text-gray-600">
                            Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                          </p>
                        </div>
                      </div>

                      {finalMatchWinner && (
                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-lg">
                          <div className="space-y-4 text-center">
                            <div>
                              <h3 className="text-xl font-bold mb-2">👑 Champions 👑</h3>
                              <p className="text-lg">
                                King {finalMatchWinner.malePlayer} & Queen {finalMatchWinner.femalePlayer}
                              </p>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold mb-2">Runners-up</h3>
                              <p>
                                Prince {finalMatchWinner.losingMalePlayer} & Princess {finalMatchWinner.losingFemalePlayer}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          <Button variant="outline" onClick={handleEditFinalMatch}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Match
                          </Button>
                          <Button variant="destructive" onClick={handleResetFinalMatch}>
                            <Trash className="w-4 h-4 mr-2" />
                            Reset Match
                          </Button>
                          {isEditingFinalMatch && (
                            <Button onClick={handleFinalMatchEditSubmit}>
                              Save Changes
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Current Match */}
                {matches && matches.length > 0 && matches[currentMatchIndex] && (
                  <Card className="mb-8 max-w-2xl mx-auto">
                    <CardHeader>
                      <div className="text-center">
                        <CardTitle className="text-2xl font-bold">
                          Match {currentMatchIndex + 1}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between gap-4">
                        <Button
                          variant="outline"
                          onClick={handlePreviousMatch}
                          disabled={currentMatchIndex === 0}
                          className="flex-shrink-0"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </Button>

                        <div className="flex-1 space-y-6">
                          <div className="flex flex-col items-center gap-4">
                            <p className="text-lg font-semibold text-center">
                              {matches[currentMatchIndex].player1.name} & {matches[currentMatchIndex].player2.name}
                            </p>
                            {!matches[currentMatchIndex].isSubmitted || isAdmin ? (
                              <Input
                                value={matches[currentMatchIndex].isSubmitted && !isAdmin ? matches[currentMatchIndex].score1 : score1}
                                onChange={(e) => setScore1(e.target.value)}
                                type="number"
                                className="w-20 text-center"
                                inputMode="numeric"
                                pattern="\d*"
                                disabled={matches[currentMatchIndex].isSubmitted && !isAdmin}
                              />
                            ) : (
                              <p className="text-xl font-bold">{matches[currentMatchIndex].score1}</p>
                            )}
                          </div>

                          <div className="flex flex-col items-center gap-4">
                            <p className="text-lg font-semibold text-center">
                              {matches[currentMatchIndex].player3.name} & {matches[currentMatchIndex].player4.name}
                            </p>
                            {!matches[currentMatchIndex].isSubmitted || isAdmin ? (
                              <Input
                                value={matches[currentMatchIndex].isSubmitted && !isAdmin ? matches[currentMatchIndex].score2 : score2}
                                onChange={(e) => setScore2(e.target.value)}
                                type="number"
                                className="w-20 text-center"
                                inputMode="numeric"
                                pattern="\d*"
                                disabled={matches[currentMatchIndex].isSubmitted && !isAdmin}
                              />
                            ) : (
                              <p className="text-xl font-bold">{matches[currentMatchIndex].score2}</p>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={handleNextMatch}
                          disabled={currentMatchIndex === matches.length - 1}
                          className="flex-shrink-0"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </Button>
                      </div>

                      {!matches[currentMatchIndex].isSubmitted ? (
                        <div className="flex justify-center">
                          <Button onClick={handleScoreSubmit} className="w-full sm:w-auto">
                            Submit Score
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="text-green-500 w-6 h-6" />
                          <p className="text-lg">Final Score: {matches[currentMatchIndex].score1} - {matches[currentMatchIndex].score2}</p>
                        </div>
                      )}

                      {isAdmin && matches[currentMatchIndex].isSubmitted && (
                        <div className="flex justify-center">
                          <Button 
                            onClick={() => handleEditScore(currentMatchIndex, parseInt(score1, 10) || 0, parseInt(score2, 10) || 0)}
                            variant="outline"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Score
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Rankings */}
                <Card className="max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">Rankings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">Name</th>
                            <th className="text-right py-2 px-2">Pts</th>
                            <th className="text-right py-2 px-2">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((player, index) => (
                            <tr key={player.name} className="border-b last:border-0">
                              <td className="py-2 px-2">{index + 1}</td>
                              <td className="py-2 px-2">{player.name}</td>
                              <td className="py-2 px-2 text-right">{player.points}</td>
                              <td className="py-2 px-2 text-right">{player.totalScores}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        )}

        {!showLoginForm && isAdmin && showPlayerManagement && (
          <Card className="mt-8 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Player Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Player */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Add New Player</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="New player name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                  />
                  <Button onClick={handleAddPlayer}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Replace Player */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Replace Player</h3>
                <div className="flex flex-col gap-2">
                  <Select
                    value={selectedPlayer?.name || ""}
                    onValueChange={(value) => setSelectedPlayer(players.find(p => p.name === value) || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select player to replace" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.name} value={player.name}>
                          {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New player name"
                      value={replacementName}
                      onChange={(e) => setReplacementName(e.target.value)}
                    />
                    <Button onClick={handleReplacePlayer} disabled={!selectedPlayer || !replacementName}>
                      <UserX className="w-4 h-4 mr-2" />
                      Replace
                    </Button>
                  </div>
                </div>
              </div>

              {/* Remove Player */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Remove Player</h3>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div key={player.name}>
                      <Button onClick={() => handleRemovePlayer(player)}>
                        <UserMinus className="w-4 h-4 mr-2" />
                        {player.name}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

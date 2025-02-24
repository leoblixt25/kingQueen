import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash, Crown, UserPlus, UserMinus, UserX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gender, Match, Player, FinalMatchScores, FinalMatchWinner } from "@/types";
import { db } from "@/lib/firebase";
import { ref, onValue, set } from "firebase/database";

const initialFemalePlayers: Player[] = [
  { name: "Lakota", points: 0, totalScores: 0 },
  { name: "Lidia", points: 0, totalScores: 0 },
  { name: "Giulia", points: 0, totalScores: 0 },
  { name: "Dina", points: 0, totalScores: 0 },
  { name: "Catalina", points: 0, totalScores: 0 },
  { name: "Izel", points: 0, totalScores: 0 },
  { name: "Marta", points: 0, totalScores: 0 },
  { name: "Eli", points: 0, totalScores: 0 },
];

const initialMalePlayers: Player[] = [
  { name: "Giacomo", points: 0, totalScores: 0 },
  { name: "David", points: 0, totalScores: 0 },
  { name: "Javi", points: 0, totalScores: 0 },
  { name: "Mauro", points: 0, totalScores: 0 },
  { name: "Mattia", points: 0, totalScores: 0 },
  { name: "Dani", points: 0, totalScores: 0 },
  { name: "Leo", points: 0, totalScores: 0 },
  { name: "Samuel", points: 0, totalScores: 0 },
];

const initialFemaleMatches: Match[] = [
  { player1: initialFemalePlayers[0], player2: initialFemalePlayers[1], player3: initialFemalePlayers[2], player4: initialFemalePlayers[3], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[4], player2: initialFemalePlayers[5], player3: initialFemalePlayers[6], player4: initialFemalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[6], player3: initialFemalePlayers[7], player4: initialFemalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[3], player2: initialFemalePlayers[4], player3: initialFemalePlayers[1], player4: initialFemalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[6], player2: initialFemalePlayers[3], player3: initialFemalePlayers[4], player4: initialFemalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[0], player2: initialFemalePlayers[2], player3: initialFemalePlayers[7], player4: initialFemalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[2], player2: initialFemalePlayers[4], player3: initialFemalePlayers[3], player4: initialFemalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[1], player2: initialFemalePlayers[6], player3: initialFemalePlayers[5], player4: initialFemalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[3], player3: initialFemalePlayers[6], player4: initialFemalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[7], player2: initialFemalePlayers[1], player3: initialFemalePlayers[0], player4: initialFemalePlayers[4], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[2], player2: initialFemalePlayers[7], player3: initialFemalePlayers[1], player4: initialFemalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[3], player2: initialFemalePlayers[0], player3: initialFemalePlayers[4], player4: initialFemalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[7], player2: initialFemalePlayers[4], player3: initialFemalePlayers[0], player4: initialFemalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[2], player3: initialFemalePlayers[6], player4: initialFemalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
];

const initialMaleMatches: Match[] = [
  { player1: initialMalePlayers[0], player2: initialMalePlayers[1], player3: initialMalePlayers[2], player4: initialMalePlayers[3], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[4], player2: initialMalePlayers[5], player3: initialMalePlayers[6], player4: initialMalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[6], player3: initialMalePlayers[7], player4: initialMalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[3], player2: initialMalePlayers[4], player3: initialMalePlayers[1], player4: initialMalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[6], player2: initialMalePlayers[3], player3: initialMalePlayers[4], player4: initialMalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[0], player2: initialMalePlayers[2], player3: initialMalePlayers[7], player4: initialMalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[2], player2: initialMalePlayers[4], player3: initialMalePlayers[3], player4: initialMalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[1], player2: initialMalePlayers[6], player3: initialMalePlayers[5], player4: initialMalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[3], player3: initialMalePlayers[6], player4: initialMalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[7], player2: initialMalePlayers[1], player3: initialMalePlayers[0], player4: initialMalePlayers[4], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[2], player2: initialMalePlayers[7], player3: initialMalePlayers[1], player4: initialMalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[3], player2: initialMalePlayers[0], player3: initialMalePlayers[4], player4: initialMalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[7], player2: initialMalePlayers[4], player3: initialMalePlayers[0], player4: initialMalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[2], player3: initialMalePlayers[6], player4: initialMalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
];

export default function BeachVolleyballTracker() {
  const [gender, setGender] = useState<Gender>("female");
  const [femalePlayers, setFemalePlayers] = useState<Player[]>(initialFemalePlayers);
  const [malePlayers, setMalePlayers] = useState<Player[]>(initialMalePlayers);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>(initialFemaleMatches);
  const [maleMatches, setMaleMatches] = useState<Match[]>(initialMaleMatches);
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
  const [selectedPlayerToReplace, setSelectedPlayerToReplace] = useState<Player | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>("female");
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [replacementName, setReplacementName] = useState("");

  useEffect(() => {
    const femaleDatabaseRef = ref(db, 'female');
    const maleDatabaseRef = ref(db, 'male');
    const finalMatchRef = ref(db, 'finalMatch');

    const femaleUnsubscribe = onValue(femaleDatabaseRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.players) setFemalePlayers(data.players);
        if (data.matches) setFemaleMatches(data.matches);
      }
    });

    const maleUnsubscribe = onValue(maleDatabaseRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.players) setMalePlayers(data.players);
        if (data.matches) setMaleMatches(data.matches);
      }
    });

    const finalMatchUnsubscribe = onValue(finalMatchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.scores) setFinalMatchScores(data.scores);
        if (data.winner) setFinalMatchWinner(data.winner);
        if (data.submitted !== undefined) setFinalMatchSubmitted(data.submitted);
      }
    });

    return () => {
      femaleUnsubscribe();
      maleUnsubscribe();
      finalMatchUnsubscribe();
    };
  }, []);

  const players = gender === 'female' ? femalePlayers : malePlayers
  const matches = gender === 'female' ? femaleMatches : maleMatches
  const setMatches = gender === 'female' ? setFemaleMatches : setMaleMatches
  const setPlayers = gender === 'female' ? setFemalePlayers : setMalePlayers

  const topPlayers = players.slice(0, 2).sort((a, b) => {
    if (b.points === a.points) {
      return b.totalScores - a.totalScores;
    }
    return b.points - a.points;
  });

  const handleScoreSubmit = () => {
    const newMatches = [...matches]
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseInt(score1, 10) || 0,
      score2: parseInt(score2, 10) || 0,
      isSubmitted: true,
    }
    setMatches(newMatches)
    updatePlayerPoints(newMatches[currentMatchIndex])
    setScore1('')
    setScore2('')
  }

  const updatePlayerPoints = (match: Match) => {
    const { player1, player2, player3, player4, score1, score2 } = match
    const newPlayers = [...players]
    const player1Index = newPlayers.findIndex(p => p.name === player1.name)
    const player2Index = newPlayers.findIndex(p => p.name === player2.name)
    const player3Index = newPlayers.findIndex(p => p.name === player3.name)
    const player4Index = newPlayers.findIndex(p => p.name === player4.name)

    if (score1 > score2) {
      newPlayers[player1Index].points += 2
      newPlayers[player2Index].points += 2
      newPlayers[player3Index].points += 1
      newPlayers[player4Index].points += 1
    } else {
      newPlayers[player1Index].points += 1
      newPlayers[player2Index].points += 1
      newPlayers[player3Index].points += 2
      newPlayers[player4Index].points += 2
    }

    newPlayers[player1Index].totalScores += score1
    newPlayers[player2Index].totalScores += score1
    newPlayers[player3Index].totalScores += score2
    newPlayers[player4Index].totalScores += score2

    setPlayers(newPlayers.sort((a, b) => {
      if (b.points === a.points) {
        return b.totalScores - a.totalScores;
      }
      return b.points - a.points;
    }))
  }

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

  const handleResetScores = () => {
    const newFemalePlayers = femalePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }))
    setFemalePlayers(newFemalePlayers)
    const newMalePlayers = malePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }))
    setMalePlayers(newMalePlayers)
    const newFemaleMatches = femaleMatches.map(match => ({ ...match, score1: 0, score2: 0, isSubmitted: false }))
    setFemaleMatches(newFemaleMatches)
    const newMaleMatches = maleMatches.map(match => ({ ...match, score1: 0, score2: 0, isSubmitted: false }))
    setMaleMatches(newMaleMatches)
  }

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
  }

  const handleFinalMatchSubmit = () => {
    const team1Scores = finalMatchScores.team1.filter(score => score !== null) as number[]
    const team2Scores = finalMatchScores.team2.filter(score => score !== null) as number[]

    const team1Wins = team1Scores.filter((score, index) => score > (team2Scores[index] || 0)).length
    const team2Wins = team2Scores.filter((score, index) => score > (team1Scores[index] || 0)).length

    let winner: FinalMatchWinner = null
    if (team1Wins > team2Wins) {
      winner = {
        team: 'team1',
        malePlayer: malePlayers[0].name,
        femalePlayer: femalePlayers[1].name,
        losingMalePlayer: malePlayers[1].name,
        losingFemalePlayer: femalePlayers[0].name,
      }
    } else if (team2Wins > team1Wins) {
      winner = {
        team: 'team2',
        malePlayer: malePlayers[1].name,
        femalePlayer: femalePlayers[0].name,
        losingMalePlayer: malePlayers[0].name,
        losingFemalePlayer: femalePlayers[1].name,
      }
    }

    setFinalMatchWinner(winner)
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
    set(ref(db, `${gender}/players`), updatedPlayers);
    setNewPlayerName("");
  };

  const handleRemovePlayer = (playerToRemove: Player) => {
    const updatedPlayers = players.filter(p => p.name !== playerToRemove.name);
    const updatedMatches = matches.filter(match => 
      match.player1.name !== playerToRemove.name &&
      match.player2.name !== playerToRemove.name &&
      match.player3.name !== playerToRemove.name &&
      match.player4.name !== playerToRemove.name
    );

    set(ref(db, `${gender}/players`), updatedPlayers);
    set(ref(db, `${gender}/matches`), updatedMatches);
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

    const updatedMatches = matches.map(match => ({
      ...match,
      player1: match.player1.name === selectedPlayer.name ? newPlayer : match.player1,
      player2: match.player2.name === selectedPlayer.name ? newPlayer : match.player2,
      player3: match.player3.name === selectedPlayer.name ? newPlayer : match.player3,
      player4: match.player4.name === selectedPlayer.name ? newPlayer : match.player4,
    }));

    set(ref(db, `${gender}/players`), updatedPlayers);
    set(ref(db, `${gender}/matches`), updatedMatches);

    setSelectedPlayer(null);
    setReplacementName("");
  };

  const currentMatch = matches[currentMatchIndex];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex items-center gap-2">
              {!isAdmin ? (
                <Button variant="outline" onClick={() => setShowLoginForm(true)}>
                  Admin Login
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleAdminLogout}>
                  Logout
                </Button>
              )}
            </div>
          </div>
        </header>

        {showLoginForm && (
          <Card className="mb-8">
            <CardHeader>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Final Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Team 1 */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <h3 className="text-lg font-semibold min-w-[200px]">
                        Team 1: {malePlayers[0].name} & {femalePlayers[1].name}
                      </h3>
                      <div className="flex gap-4">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team1-set${setIndex + 1}`}>Set {setIndex + 1}</Label>
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
                              className="w-16"
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <h3 className="text-lg font-semibold min-w-[200px]">
                        Team 2: {femalePlayers[0].name} & {malePlayers[1].name}
                      </h3>
                      <div className="flex gap-4">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team2-set${setIndex + 1}`}>Set {setIndex + 1}</Label>
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
                              className="w-16"
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
                    <Button onClick={handleFinalMatchSubmit} className="w-full sm:w-auto">
                      Submit Final Match
                    </Button>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4">Final Match Results</h3>
                        <p className="text-gray-600">
                          Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                        </p>
                        <p className="text-gray-600">
                          Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                        </p>
                      </div>

                      {finalMatchWinner && (
                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-lg">
                          <div className="space-y-4">
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
                        <div className="flex flex-col sm:flex-row gap-2">
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
                {/* Current Match - Now First */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">
                      Match {currentMatchIndex + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <p className="text-lg font-semibold min-w-[200px]">
                          {currentMatch.player1.name} & {currentMatch.player2.name}
                        </p>
                        {!currentMatch.isSubmitted || isAdmin ? (
                          <Input
                            value={currentMatch.isSubmitted && !isAdmin ? currentMatch.score1 : score1}
                            onChange={(e) => setScore1(e.target.value)}
                            type="number"
                            className="w-20"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && !isAdmin}
                          />
                        ) : (
                          <p className="text-xl font-bold">{currentMatch.score1}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <p className="text-lg font-semibold min-w-[200px]">
                          {currentMatch.player3.name} & {currentMatch.player4.name}
                        </p>
                        {!currentMatch.isSubmitted || isAdmin ? (
                          <Input
                            value={currentMatch.isSubmitted && !isAdmin ? currentMatch.score2 : score2}
                            onChange={(e) => setScore2(e.target.value)}
                            type="number"
                            className="w-20"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && !isAdmin}
                          />
                        ) : (
                          <p className="text-xl font-bold">{currentMatch.score2}</p>
                        )}
                      </div>
                    </div>

                    {!currentMatch.isSubmitted ? (
                      <Button onClick={handleScoreSubmit} className="w-full sm:w-auto">
                        Submit Score
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Check className="text-green-500 w-6 h-6" />
                        <p className="text-lg">
                          Final Score: {currentMatch.score1} - {currentMatch.score2}
                        </p>
                      </div>
                    )}

                    {isAdmin && currentMatch.isSubmitted && (
                      <Button 
                        onClick={() => handleEditScore(currentMatchIndex, parseInt(score1, 10) || 0, parseInt(score2, 10) || 0)}
                        variant="outline"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Score
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Rankings Table - Now Second */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">
                      {gender.charAt(0).toUpperCase() + gender.slice(1)} Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4">Rank</th>
                            <th className="text-left py-2 px-4">Player</th>
                            <th className="text-right py-2 px-4">Points</th>
                            <th className="text-right py-2 px-4">Total Scores</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((player, index) => (
                            <tr key={player.name} className="border-b last:border-0">
                              <td className="py-2 px-4">{index + 1}</td>
                              <td className="py-2 px-4">{player.name}</td>
                              <td className="py-2 px-4 text-right">{player.points}</td>
                              <td className="py-2 px-4 text-right">{player.totalScores}</td>
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
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Player Management</CardTitle>
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
                    <div key={player.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{player.name}</span>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRemovePlayer(player)}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Remove
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

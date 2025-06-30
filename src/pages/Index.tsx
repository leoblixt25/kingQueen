import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash, Crown, UserPlus, UserMinus, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gender, Player } from "@/types";
import { useTournamentData } from "@/hooks/useTournamentData";

export default function BeachVolleyballTracker() {
  const [gender, setGender] = useState<Gender>("female");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showFinalMatch, setShowFinalMatch] = useState(false);
  const [isEditingFinalMatch, setIsEditingFinalMatch] = useState(false);
  const [selectedPlayerToReplace, setSelectedPlayerToReplace] = useState<Player | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>("female");
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [replacementName, setReplacementName] = useState("");

  const {
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
  } = useTournamentData();

  const players = gender === 'female' ? femalePlayers : malePlayers
  const matches = gender === 'female' ? femaleMatches : maleMatches

  const handleScoreSubmit = async () => {
    const scoreValue1 = parseInt(score1, 10) || 0;
    const scoreValue2 = parseInt(score2, 10) || 0;
    
    await updateMatchScore(currentMatchIndex, scoreValue1, scoreValue2, gender);
    
    setScore1('');
    setScore2('');
    
    // Auto-advance to next unfinished match
    const nextUnfinishedIndex = matches.findIndex((match, index) => 
      index > currentMatchIndex && !match.isSubmitted
    );
    if (nextUnfinishedIndex !== -1) {
      setCurrentMatchIndex(nextUnfinishedIndex);
    }
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

  const handleResetScores = async () => {
    await resetAllData();
    setCurrentMatchIndex(0);
    setScore1('');
    setScore2('');
  }

  const handleEditScore = async (matchIndex: number, newScore1: number, newScore2: number) => {
    await updateMatchScore(matchIndex, newScore1, newScore2, gender);
  }

  const handleFinalMatchSubmit = async () => {
    await updateFinalMatch(finalMatchScores);
  }

  const handleEditFinalMatch = () => {
    setIsEditingFinalMatch(true)
  }

  const handleFinalMatchEditSubmit = async () => {
    setIsEditingFinalMatch(false);
    await updateFinalMatch(finalMatchScores);
  }

  const handleResetFinalMatch = async () => {
    const resetScores: FinalMatchScores = { 
      team1: [null, null, null], 
      team2: [null, null, null] 
    };
    setFinalMatchScores(resetScores);
    await updateFinalMatch(resetScores);
  }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-4 py-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Tournament Data...</h2>
          <p className="text-gray-600">Setting up the beach volleyball tracker</p>
        </div>
      </div>
    );
  }

  const currentMatch = matches[currentMatchIndex];

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-white px-4 py-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No matches available</h2>
          <p className="text-gray-600">Please check back later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold text-center">Beach Volleyball Tracker</h1>
            <div className="flex flex-col gap-2 w-full">
              <Button 
                variant={gender === 'female' ? "default" : "outline"} 
                onClick={() => { setGender('female'); setShowFinalMatch(false); }}
                className="w-full"
              >
                Female
              </Button>
              <Button 
                variant={gender === 'male' ? "default" : "outline"}
                onClick={() => { setGender('male'); setShowFinalMatch(false); }}
                className="w-full"
              >
                Male
              </Button>
              <Button 
                variant={showFinalMatch ? "default" : "outline"}
                onClick={() => setShowFinalMatch(true)}
                className="w-full"
              >
                Final Match
              </Button>
            </div>
            <div className="w-full">
              {!isAdmin ? (
                <Button variant="outline" onClick={() => setShowLoginForm(true)} className="w-full">
                  Admin Login
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button variant="destructive" onClick={handleAdminLogout} className="w-full">
                    Logout
                  </Button>
                  <Button variant="destructive" onClick={handleResetScores} className="w-full">
                    <Trash className="w-4 h-4 mr-2" />
                    Reset All Scores
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {showLoginForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Admin Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Username</Label>
                <Input
                  id="adminUsername"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  type="text"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  className="w-full"
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
                  <CardTitle className="text-xl font-bold text-center">Final Match</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Team 1 */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-center">
                      Team 1: {malePlayers[0]?.name} & {femalePlayers[1]?.name}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((setIndex) => (
                        <div key={setIndex} className="space-y-2">
                          <Label htmlFor={`team1-set${setIndex + 1}`} className="text-sm text-center block">Set {setIndex + 1}</Label>
                          <Input
                            id={`team1-set${setIndex + 1}`}
                            value={finalMatchScores.team1[setIndex] !== null ? finalMatchScores.team1[setIndex] : ''}
                            onChange={(e) => {
                              const newScores: [number | null, number | null, number | null] = [...finalMatchScores.team1];
                              newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              setFinalMatchScores({
                                ...finalMatchScores,
                                team1: newScores
                              });
                            }}
                            type="number"
                            className="text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={finalMatchSubmitted && !isEditingFinalMatch}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-center">
                      Team 2: {femalePlayers[0]?.name} & {malePlayers[1]?.name}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((setIndex) => (
                        <div key={setIndex} className="space-y-2">
                          <Label htmlFor={`team2-set${setIndex + 1}`} className="text-sm text-center block">Set {setIndex + 1}</Label>
                          <Input
                            id={`team2-set${setIndex + 1}`}
                            value={finalMatchScores.team2[setIndex] !== null ? finalMatchScores.team2[setIndex] : ''}
                            onChange={(e) => {
                              const newScores: [number | null, number | null, number | null] = [...finalMatchScores.team2];
                              newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              setFinalMatchScores({
                                ...finalMatchScores,
                                team2: newScores
                              });
                            }}
                            type="number"
                            className="text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={finalMatchSubmitted && !isEditingFinalMatch}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {!finalMatchSubmitted ? (
                    <Button onClick={handleFinalMatchSubmit} className="w-full">
                      Submit Final Match
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <h3 className="text-lg font-semibold mb-2">Final Match Results</h3>
                        <p className="text-gray-600 text-sm">
                          Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                        </p>
                        <p className="text-gray-600 text-sm">
                          Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                        </p>
                      </div>

                      {finalMatchWinner && (
                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-lg text-center">
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-lg font-bold mb-2">👑 Champions 👑</h3>
                              <p className="text-sm">
                                King {finalMatchWinner.malePlayer} & Queen {finalMatchWinner.femalePlayer}
                              </p>
                            </div>
                            <div>
                              <h3 className="text-md font-semibold mb-1">Runners-up</h3>
                              <p className="text-sm">
                                Prince {finalMatchWinner.losingMalePlayer} & Princess {finalMatchWinner.losingFemalePlayer}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" onClick={handleEditFinalMatch} className="w-full">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Match
                          </Button>
                          <Button variant="destructive" onClick={handleResetFinalMatch} className="w-full">
                            <Trash className="w-4 h-4 mr-2" />
                            Reset Match
                          </Button>
                          {isEditingFinalMatch && (
                            <Button onClick={handleFinalMatchEditSubmit} className="w-full">
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
                {/* Current Match with Navigation */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col items-center gap-3">
                      <CardTitle className="text-xl font-bold text-center">
                        Match {currentMatchIndex + 1} of {matches.length}
                      </CardTitle>
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousMatch}
                          disabled={currentMatchIndex === 0}
                          className="flex-1"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextMatch}
                          disabled={currentMatchIndex === matches.length - 1}
                          className="flex-1"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm font-semibold mb-2">
                          {currentMatch.player1.name} & {currentMatch.player2.name}
                        </p>
                        {!currentMatch.isSubmitted || isAdmin ? (
                          <Input
                            value={currentMatch.isSubmitted && !isAdmin ? currentMatch.score1 : score1}
                            onChange={(e) => setScore1(e.target.value)}
                            type="number"
                            className="w-20 mx-auto text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && !isAdmin}
                          />
                        ) : (
                          <p className="text-2xl font-bold text-primary">{currentMatch.score1}</p>
                        )}
                      </div>

                      <div className="text-center text-lg font-bold">VS</div>

                      <div className="text-center">
                        <p className="text-sm font-semibold mb-2">
                          {currentMatch.player3.name} & {currentMatch.player4.name}
                        </p>
                        {!currentMatch.isSubmitted || isAdmin ? (
                          <Input
                            value={currentMatch.isSubmitted && !isAdmin ? currentMatch.score2 : score2}
                            onChange={(e) => setScore2(e.target.value)}
                            type="number"
                            className="w-20 mx-auto text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && !isAdmin}
                          />
                        ) : (
                          <p className="text-2xl font-bold text-primary">{currentMatch.score2}</p>
                        )}
                      </div>
                    </div>

                    {!currentMatch.isSubmitted ? (
                      <Button onClick={handleScoreSubmit} className="w-full">
                        Submit Score
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 bg-green-50 p-3 rounded-lg">
                        <Check className="text-green-500 w-5 h-5" />
                        <p className="text-sm font-medium">
                          Final Score: {currentMatch.score1} - {currentMatch.score2}
                        </p>
                      </div>
                    )}

                    {isAdmin && currentMatch.isSubmitted && (
                      <Button 
                        onClick={() => {
                          setScore1(currentMatch.score1.toString());
                          setScore2(currentMatch.score2.toString());
                          handleEditScore(currentMatchIndex, currentMatch.score1, currentMatch.score2);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Score
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Rankings Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-center">
                      {gender.charAt(0).toUpperCase() + gender.slice(1)} Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {players.map((player, index) => (
                        <div key={player.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-primary">#{index + 1}</span>
                            <span className="font-medium">{player.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{player.points} pts</div>
                            <div className="text-xs text-gray-500">{player.totalScores} total</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
}


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash, Crown, ChevronLeft, ChevronRight, Home, Users, RotateCcw } from "lucide-react";
import { Gender, FinalMatchScores } from "@/types";
import { useTournamentData } from "@/hooks/useTournamentData";

import { PlayerReplacer } from "@/components/PlayerReplacer";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function KingQueenOfTheBeach() {
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
  const [showPlayerReplacer, setShowPlayerReplacer] = useState(false);
  
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

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
    resetScores,
    resetAllData,
    retryMatchInitialization,
    setFinalMatchScores,
    loadTournamentData
  } = useTournamentData();

  const players = gender === 'female' ? femalePlayers : malePlayers
  const matches = gender === 'female' ? femaleMatches : maleMatches

  // Debug logging
  console.log('Current gender:', gender);
  console.log('Female players:', femalePlayers);
  console.log('Male players:', malePlayers);
  console.log('Current players array:', players);
  console.log('Players length:', players.length);

  // Reset currentMatchIndex when gender changes
  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender);
    setCurrentMatchIndex(0);
    setScore1('');
    setScore2('');
    setShowFinalMatch(false);
  };

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
    if (window.confirm('Are you sure you want to reset all scores? This will clear all match scores and player points but keep player names and matchups.')) {
      await resetScores();
      setCurrentMatchIndex(0);
      setScore1('');
      setScore2('');
      toast({
        title: "Scores Reset",
        description: "All scores have been reset successfully",
      });
    }
  };

  const handleFullReset = async () => {
    if (window.confirm('Are you sure you want to completely reset everything? This will delete all data and reinitialize the tournament.')) {
      await resetAllData();
      setCurrentMatchIndex(0);
      setScore1('');
      setScore2('');
      toast({
        title: "Tournament Reset",
        description: "Tournament has been completely reset",
      });
    }
  };

  const handleEditMatch = (match: any, matchIndex: number) => {
    setEditingMatchId(match.id);
    setCurrentMatchIndex(matchIndex);
    setScore1(match.score1.toString());
    setScore2(match.score2.toString());
  }

  const handleSaveMatchEdit = async () => {
    if (!editingMatchId) return;
    
    const scoreValue1 = parseInt(score1, 10) || 0;
    const scoreValue2 = parseInt(score2, 10) || 0;
    
    try {
      // Use the same approach as handleScoreSubmit - let real-time subscriptions handle updates
      await updateMatchScore(currentMatchIndex, scoreValue1, scoreValue2, gender, true);
      
      setEditingMatchId(null);
      setScore1('');
      setScore2('');
      
      toast({
        title: "Score Updated",
        description: "Match score and rankings updated successfully",
      });
    } catch (error) {
      console.error('Error updating match score:', error);
      toast({
        title: "Error",
        description: "Failed to update match score",
        variant: "destructive",
      });
    }
  }

  const handleCancelEdit = () => {
    setEditingMatchId(null);
    setScore1('');
    setScore2('');
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
      const newIndex = currentMatchIndex - 1;
      setCurrentMatchIndex(newIndex);
      setEditingMatchId(null); // Reset edit mode
      setScore1('');
      setScore2('');
    }
  };

  const handleNextMatch = () => {
    if (currentMatchIndex < matches.length - 1) {
      const newIndex = currentMatchIndex + 1;
      setCurrentMatchIndex(newIndex);
      setEditingMatchId(null); // Reset edit mode
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

  if (!currentMatch || matches.length === 0) {
    return (
      <div className="min-h-screen bg-white px-4 py-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold mb-2">No matches available</h2>
          <p className="text-gray-600">Matches are being initialized. Please wait a moment and refresh.</p>
          <div className="space-y-2">
            <Button 
              onClick={retryMatchInitialization} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Retry Match Initialization
            </Button>
            {isAdmin && (
              <Button onClick={handleResetScores} variant="destructive">
                Reset and Reinitialize Data
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <header>
          <div className="flex flex-col items-center gap-4 relative">
            {/* Admin Login Button - Top Right */}
            <div className="absolute top-0 right-0">
              {!isAdmin && !showLoginForm ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowLoginForm(true)}
                  className="text-xs px-2 py-1"
                >
                  Admin
                </Button>
              ) : isAdmin && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleAdminLogout}
                  className="text-xs px-2 py-1"
                >
                  Logout
                </Button>
              )}
            </div>

            <h1 className="text-2xl font-bold text-center">King & Queen Of The Beach</h1>
            <div className="flex flex-col gap-2 w-full">
              <Button 
                variant={gender === 'female' ? "default" : "outline"} 
                onClick={() => handleGenderChange('female')}
                className="w-full"
              >
                Female
              </Button>
              <Button 
                variant={gender === 'male' ? "default" : "outline"}
                onClick={() => handleGenderChange('male')}
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
            
            {/* Admin Controls - Only show when admin is logged in */}
            {isAdmin && !showLoginForm && (
              <div className="w-full space-y-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPlayerReplacer(true)} 
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Replace Players
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleResetScores} 
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Scores Only
                </Button>
                <Button variant="destructive" onClick={handleFullReset} className="w-full">
                  <Trash className="w-4 h-4 mr-2" />
                  Reset Everything
                </Button>
              </div>
            )}
          </div>
        </header>

        {showLoginForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-center flex-1">Admin Login</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowLoginForm(false)}
                  className="p-1"
                >
                  <Home className="w-4 h-4" />
                </Button>
              </div>
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

        {showPlayerReplacer && isAdmin && (
          <PlayerReplacer 
            femalePlayers={femalePlayers}
            malePlayers={malePlayers}
            onClose={() => setShowPlayerReplacer(false)}
            onSuccess={() => {
              // Data will be automatically refreshed via real-time subscriptions
            }}
          />
        )}


        {!showLoginForm && !showPlayerReplacer && (
          <main>
            {showFinalMatch ? (
              <div className="space-y-6">
                {/* Final Match Header */}
                <div className="text-center">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
                    <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                      <Crown className="w-6 h-6" />
                      Final Championship Match
                      <Crown className="w-6 h-6" />
                    </h2>
                    <p className="text-blue-100">The ultimate showdown for the crown!</p>
                  </div>
                </div>

                {/* Teams Display */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Team 1 */}
                  <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-blue-800">
                        Team 1
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-sm text-blue-600 font-semibold">
                          {malePlayers[0]?.name} & {femalePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team1-set${setIndex + 1}`} className="text-xs font-medium text-center block text-blue-700">
                              Set {setIndex + 1}
                            </Label>
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
                              className="text-center font-bold text-lg border-blue-300 focus:border-blue-500"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* VS Divider */}
                  <div className="flex items-center justify-center">
                    <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg">
                      VS
                    </div>
                  </div>

                  {/* Team 2 */}
                  <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-purple-800">
                        Team 2
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-sm text-purple-600 font-semibold">
                          {femalePlayers[0]?.name} & {malePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team2-set${setIndex + 1}`} className="text-xs font-medium text-center block text-purple-700">
                              Set {setIndex + 1}
                            </Label>
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
                              className="text-center font-bold text-lg border-purple-300 focus:border-purple-500"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                {!finalMatchSubmitted ? (
                  <Button 
                    onClick={handleFinalMatchSubmit} 
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 text-lg shadow-lg"
                  >
                    Submit Final Match
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {/* Results Summary */}
                    <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <Check className="text-green-600 w-6 h-6" />
                            <h3 className="text-lg font-bold text-green-800">Match Complete!</h3>
                            <Check className="text-green-600 w-6 h-6" />
                          </div>
                          <div className="space-y-2 text-sm">
                            <p className="font-semibold text-green-700">
                              Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                            </p>
                            <p className="font-semibold text-green-700">
                              Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Winners Display */}
                    {finalMatchWinner && (
                      <Card className="border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 shadow-lg">
                        <CardContent className="p-6">
                          <div className="text-center space-y-4">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-lg p-4">
                              <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">
                                <Crown className="w-8 h-8" />
                                Champions
                                <Crown className="w-8 h-8" />
                              </h3>
                              <div className="space-y-2">
                                <p className="text-lg font-semibold">
                                  👑 King {finalMatchWinner.malePlayer}
                                </p>
                                <p className="text-lg font-semibold">
                                  👑 Queen {finalMatchWinner.femalePlayer}
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg p-4">
                              <h3 className="text-lg font-semibold mb-2 text-gray-700">Runners-up</h3>
                              <div className="space-y-1 text-gray-600">
                                <p>🤴 Prince {finalMatchWinner.losingMalePlayer}</p>
                                <p>👸 Princess {finalMatchWinner.losingFemalePlayer}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Admin Controls */}
                    {isAdmin && (
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          onClick={handleEditFinalMatch} 
                          className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Match
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleResetFinalMatch} 
                          className="w-full"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Reset Match
                        </Button>
                        {isEditingFinalMatch && (
                          <Button 
                            onClick={handleFinalMatchEditSubmit} 
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            Save Changes
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Current Match with Navigation */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col items-center gap-3">
                      <CardTitle className="text-xl font-bold text-center">
                        {gender.charAt(0).toUpperCase() + gender.slice(1)} Match {currentMatchIndex + 1} of {matches.length}
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
                        <span className="text-sm text-gray-500">
                          {currentMatchIndex + 1}/{matches.length}
                        </span>
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
                        {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                          <Input
                            value={editingMatchId === currentMatch.id ? score1 : (currentMatch.isSubmitted ? currentMatch.score1 : score1)}
                            onChange={(e) => setScore1(e.target.value)}
                            type="number"
                            className="w-20 mx-auto text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
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
                        {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                          <Input
                            value={editingMatchId === currentMatch.id ? score2 : (currentMatch.isSubmitted ? currentMatch.score2 : score2)}
                            onChange={(e) => setScore2(e.target.value)}
                            type="number"
                            className="w-20 mx-auto text-center"
                            inputMode="numeric"
                            pattern="\d*"
                            disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
                          />
                        ) : (
                          <p className="text-2xl font-bold text-primary">{currentMatch.score2}</p>
                        )}
                      </div>
                    </div>

                    {!currentMatch.isSubmitted && editingMatchId !== currentMatch.id ? (
                      <Button onClick={handleScoreSubmit} className="w-full">
                        Submit Score
                      </Button>
                    ) : editingMatchId === currentMatch.id ? (
                      <div className="flex gap-2">
                        <Button onClick={handleSaveMatchEdit} className="flex-1">
                          Save Score
                        </Button>
                        <Button onClick={handleCancelEdit} variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2 bg-green-50 p-3 rounded-lg">
                          <Check className="text-green-500 w-5 h-5" />
                          <p className="text-sm font-medium">
                            Final Score: {currentMatch.score1} - {currentMatch.score2}
                          </p>
                        </div>
                        {isAdmin && (
                          <Button 
                            onClick={() => handleEditMatch(currentMatch, currentMatchIndex)}
                            variant="outline"
                            className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Score
                          </Button>
                        )}
                      </>
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
                        <div key={`${player.name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
      <Toaster />
    </div>
  );
}

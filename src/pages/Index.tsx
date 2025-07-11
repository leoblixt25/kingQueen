
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
import { supabase } from "@/integrations/supabase/client";

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
    
    console.log(`🚀 EDIT SCORE STARTED: match=${currentMatchIndex}, scores=${scoreValue1}-${scoreValue2}, gender=${gender}`);
    
    try {
      // Use the same approach as handleScoreSubmit - let real-time subscriptions handle updates
      await updateMatchScore(currentMatchIndex, scoreValue1, scoreValue2, gender, true);
      
      console.log(`🚀 EDIT SCORE COMPLETED, forcing data reload...`);
      
      // Force reload data after edit
      await loadTournamentData();
      
      console.log(`🚀 FORCED RELOAD COMPLETED`);
      
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
    if (!window.confirm('Are you sure you want to reset the final match? This will clear all final match data.')) {
      return;
    }
    
    try {
      // Reset the database final match record
      const { error } = await supabase
        .from('final_matches')
        .delete()
        .eq('is_completed', true);
      
      if (error) {
        console.error('Error resetting final match:', error);
        throw error;
      }
      
      // Reset local state
      const resetScores: FinalMatchScores = { 
        team1: [null, null, null], 
        team2: [null, null, null] 
      };
      setFinalMatchScores(resetScores);
      setIsEditingFinalMatch(false);
      
      // Reload data to ensure consistency
      await loadTournamentData();
      
      console.log('✅ Final match reset successfully');
    } catch (error) {
      console.error('❌ Error resetting final match:', error);
      alert('Failed to reset final match. Please try again.');
    }
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
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Loading Tournament Data...
          </h2>
          <p className="text-foreground/70 font-medium">🌊 Setting up the beach volleyball tracker 🏖️</p>
        </div>
      </div>
    );
  }

  const currentMatch = matches[currentMatchIndex];

  if (!currentMatch || matches.length === 0) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold mb-3 bg-sunset-gradient bg-clip-text text-transparent">No matches available</h2>
          <p className="text-foreground/70 font-medium mb-6">Matches are being initialized. Please wait a moment and refresh.</p>
          <div className="space-y-3 max-w-sm mx-auto">
            <Button 
              onClick={retryMatchInitialization} 
              className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
            >
              🔄 Retry Match Initialization
            </Button>
            {isAdmin && (
              <Button 
                onClick={handleResetScores} 
                variant="destructive"
                className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
              >
                Reset and Reinitialize Data
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <header>
          <div className="flex flex-col items-center gap-6 relative">
            {/* Admin Login Button - Top Right */}
            <div className="absolute -top-2 right-0">
              {!isAdmin && !showLoginForm ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowLoginForm(true)}
                  className="text-xs px-4 py-2 touch-target bg-white/80 backdrop-blur-sm border-ocean/20 hover:bg-ocean hover:text-white transition-all duration-300"
                >
                  🏖️ Admin
                </Button>
              ) : isAdmin && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleAdminLogout}
                  className="text-xs px-4 py-2 touch-target bg-coral hover:bg-coral-dark transition-all duration-300"
                >
                  Logout
                </Button>
              )}
            </div>

            <div className="text-center pt-8">
              <div className="relative">
                <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-4 drop-shadow-sm">
                  King & Queen of the Beach
                </h1>
                <div className="w-16 h-1 bg-sunset mx-auto rounded-full"></div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <Button 
                variant={gender === 'female' ? "default" : "outline"} 
                onClick={() => handleGenderChange('female')}
                className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                  gender === 'female' 
                    ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach animate-pulse-glow' 
                    : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
                }`}
              >
                👩 Female Division
              </Button>
              <Button 
                variant={gender === 'male' ? "default" : "outline"}
                onClick={() => handleGenderChange('male')}
                className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                  gender === 'male' 
                    ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach animate-pulse-glow' 
                    : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
                }`}
              >
                👨 Male Division  
              </Button>
              <Button 
                variant={showFinalMatch ? "default" : "outline"}
                onClick={() => setShowFinalMatch(true)}
                className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                  showFinalMatch 
                    ? 'bg-beach-gradient text-white shadow-beach animate-bounce-gentle' 
                    : 'bg-white/70 hover:bg-beach-gradient hover:text-white border-primary/20 text-primary shadow-sand'
                }`}
              >
                👑 Championship Final
              </Button>
            </div>
            
            {/* Admin Controls - Only show when admin is logged in */}
            {isAdmin && !showLoginForm && (
              <div className="w-full max-w-sm space-y-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-sand-dark/20 shadow-sand">
                <div className="text-center mb-2">
                  <p className="text-sm font-semibold text-foreground/70">🔧 Admin Controls</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPlayerReplacer(true)} 
                  className="w-full touch-target bg-white/70 hover:bg-palm hover:text-white border-palm/30 text-palm-dark transition-all duration-300"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Replace Players
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleResetScores} 
                  className="w-full touch-target bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark transition-all duration-300"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Scores Only
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleFullReset} 
                  className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Reset Everything
                </Button>
              </div>
            )}
          </div>
        </header>

        {showLoginForm && (
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-center flex-1 text-ocean font-bold">🔐 Admin Login</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowLoginForm(false)}
                  className="p-2 hover:bg-sand-light rounded-full transition-colors"
                >
                  <Home className="w-4 h-4 text-ocean" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminUsername" className="text-foreground font-medium">Username</Label>
                <Input
                  id="adminUsername"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  type="text"
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword" className="text-foreground font-medium">Password</Label>
                <Input
                  id="adminPassword"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                />
              </div>
              <Button 
                onClick={handleAdminLogin} 
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
              >
                🚀 Login
              </Button>
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
                  <div className="bg-beach-gradient text-white rounded-2xl p-6 shadow-beach">
                    <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                      <Crown className="w-6 h-6" />
                       Championship Final 
                      <Crown className="w-6 h-6" />
                    </h2>
                  </div>
                </div>

                {/* Teams Display */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Team 1 */}
                  <Card className="border-2 border-ocean/20 bg-white/80 backdrop-blur-sm shadow-beach">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-ocean">
                        🏐 Team 1
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-xl text-ocean-dark font-semibold">
                          {malePlayers[0]?.name} & {femalePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team1-set${setIndex + 1}`} className="text-base font-medium text-center block text-ocean">
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
                              className="text-center font-bold text-xl touch-target border-ocean/30 focus:border-ocean bg-white/70"
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
                    <div className="bg-sunset-gradient text-white px-8 py-3 rounded-full font-bold text-xl shadow-beach animate-pulse-glow">
                      ⚡ VS ⚡
                    </div>
                  </div>

                  {/* Team 2 */}
                  <Card className="border-2 border-sunset/20 bg-white/80 backdrop-blur-sm shadow-beach">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-sunset">
                        🏐 Team 2
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-xl text-sunset-dark font-semibold">
                          {femalePlayers[0]?.name} & {malePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team2-set${setIndex + 1}`} className="text-base font-medium text-center block text-sunset">
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
                              className="text-center font-bold text-xl touch-target border-sunset/30 focus:border-sunset bg-white/70"
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
                    className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-4 text-lg shadow-beach transition-all duration-300"
                  >
                    🚀 Submit Championship Match
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {/* Results Summary */}
                    <Card className="border-2 border-palm/30 bg-palm-light/20 backdrop-blur-sm shadow-beach">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <Check className="text-palm w-6 h-6" />
                            <h3 className="text-lg font-bold text-palm-dark">🎉 Match Complete! 🎉</h3>
                            <Check className="text-palm w-6 h-6" />
                          </div>
                          <div className="space-y-2 text-sm">
                            <p className="font-semibold text-palm-dark">
                              Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                            </p>
                            <p className="font-semibold text-palm-dark">
                              Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Winners Display */}
                    {finalMatchWinner && (
                      <Card className="border-2 border-sunset/30 bg-sunset-gradient shadow-beach">
                        <CardContent className="p-6">
                          <div className="text-center space-y-4">
                            <div className="bg-white/20 backdrop-blur-sm text-white rounded-2xl p-4">
                              <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">
                                <Crown className="w-8 h-8" />
                                🏆 Champions 🏆
                                <Crown className="w-8 h-8" />
                              </h3>
                              <div className="space-y-2">
                                <p className="text-lg font-semibold">
                                  👑 King <span className="font-bold">{finalMatchWinner.malePlayer}</span>
                                </p>
                                <p className="text-lg font-semibold">
                                  👑 Queen <span className="font-bold">{finalMatchWinner.femalePlayer}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
                              <h3 className="text-lg font-semibold mb-2 text-foreground/80">🥈 Runners-up</h3>
                              <div className="space-y-1 text-foreground/70">
                                <p>🤴 Prince <span className="font-bold">{finalMatchWinner.losingMalePlayer}</span></p>
                                <p>👸 Princess <span className="font-bold">{finalMatchWinner.losingFemalePlayer}</span></p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Admin Controls */}
                    {isAdmin && (
                      <div className="flex flex-col gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleEditFinalMatch} 
                          className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Match
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleResetFinalMatch} 
                          className="w-full touch-target bg-coral hover:bg-coral-dark transition-all duration-300"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Reset Match
                        </Button>
                        {isEditingFinalMatch && (
                          <Button 
                            onClick={handleFinalMatchEditSubmit} 
                            className="w-full touch-target bg-palm hover:bg-palm-dark text-white transition-all duration-300"
                          >
                            💾 Save Changes
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
                <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
                  <CardHeader>
                    <div className="flex flex-col items-center gap-3">
                      <CardTitle className="text-xl font-bold text-center bg-ocean-gradient bg-clip-text text-transparent">
                        🏐 {gender.charAt(0).toUpperCase() + gender.slice(1)} Match {currentMatchIndex + 1} of {matches.length}
                      </CardTitle>
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousMatch}
                          disabled={currentMatchIndex === 0}
                          className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm font-bold text-foreground/70 px-2">
                          {currentMatchIndex + 1}/{matches.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextMatch}
                          disabled={currentMatchIndex === matches.length - 1}
                          className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Team 1 */}
                    <Card className="border-2 border-ocean/20 bg-ocean/5 shadow-sand">
                      <CardContent className="p-4">
                        <div className="text-center space-y-3">
                          <div className="bg-ocean text-white rounded-xl py-4 px-4 shadow-beach">
                            <p className="text-lg font-bold">
                              {currentMatch.player1.name} & {currentMatch.player2.name}
                            </p>
                          </div>
                          {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                            <Input
                              value={editingMatchId === currentMatch.id ? score1 : (currentMatch.isSubmitted ? currentMatch.score1 : score1)}
                              onChange={(e) => setScore1(e.target.value)}
                              type="number"
                              className="w-24 mx-auto text-center text-2xl font-bold touch-target border-ocean/30 focus:border-ocean bg-white/80"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
                              placeholder="0"
                            />
                          ) : (
                            <div className="bg-ocean text-white rounded-xl py-4 shadow-beach">
                              <p className="text-4xl font-bold">{currentMatch.score1}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* VS Divider */}
                    <div className="flex items-center justify-center">
                      <div className="bg-sunset-gradient text-white px-8 py-3 rounded-full font-bold text-xl shadow-beach animate-pulse-glow">
                        ⚡ VS ⚡
                      </div>
                    </div>

                    {/* Team 2 */}
                    <Card className="border-2 border-sunset/20 bg-sunset/5 shadow-sand">
                      <CardContent className="p-4">
                        <div className="text-center space-y-3">
                          <div className="bg-sunset text-white rounded-xl py-4 px-4 shadow-beach">
                            <p className="text-lg font-bold">
                              {currentMatch.player3.name} & {currentMatch.player4.name}
                            </p>
                          </div>
                          {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                            <Input
                              value={editingMatchId === currentMatch.id ? score2 : (currentMatch.isSubmitted ? currentMatch.score2 : score2)}
                              onChange={(e) => setScore2(e.target.value)}
                              type="number"
                              className="w-24 mx-auto text-center text-2xl font-bold touch-target border-sunset/30 focus:border-sunset bg-white/80"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
                              placeholder="0"
                            />
                          ) : (
                            <div className="bg-sunset text-white rounded-xl py-4 shadow-beach">
                              <p className="text-4xl font-bold">{currentMatch.score2}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    {!currentMatch.isSubmitted && editingMatchId !== currentMatch.id ? (
                      <Button 
                        onClick={handleScoreSubmit} 
                        className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-4 text-lg shadow-beach transition-all duration-300"
                      >
                        🚀 Submit Score
                      </Button>
                    ) : editingMatchId === currentMatch.id ? (
                      <div className="flex gap-3">
                        <Button 
                          onClick={handleSaveMatchEdit} 
                          className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white transition-all duration-300"
                        >
                          💾 Save Score
                        </Button>
                        <Button 
                          onClick={handleCancelEdit} 
                          variant="outline" 
                          className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                        >
                          ❌ Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2 bg-palm/10 p-4 rounded-xl border border-palm/20">
                          <Check className="text-palm w-6 h-6" />
                          <p className="font-bold text-palm-dark">
                            🎯 Final Score: {currentMatch.score1} - {currentMatch.score2}
                          </p>
                        </div>
                        {isAdmin && (
                          <Button 
                            onClick={() => handleEditMatch(currentMatch, currentMatchIndex)}
                            variant="outline"
                            className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            ✏️ Edit Score
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Rankings Table */}
                <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-center bg-sunset-gradient bg-clip-text text-transparent">
                      🏆 {gender.charAt(0).toUpperCase() + gender.slice(1)} Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {players.map((player, index) => (
                        <div key={`${player.name}-${index}`} className={`flex items-center justify-between p-4 rounded-xl shadow-sand transition-all duration-300 ${
                          index === 0 ? 'bg-sunset-gradient text-white' : 
                          index === 1 ? 'bg-ocean/20 border-2 border-ocean/30' : 
                          index === 2 ? 'bg-palm/20 border-2 border-palm/30' : 
                          'bg-sand-light/50'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-xl font-bold ${
                              index === 0 ? 'text-white' : 
                              index === 1 ? 'text-ocean' : 
                              index === 2 ? 'text-palm' : 
                              'text-foreground'
                            }`}>
                              #{index + 1}
                            </span>
                            <span className={`font-bold text-lg ${
                              index === 0 ? 'text-white' : 'text-foreground'
                            }`}>{player.name}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              index === 0 ? 'text-white' : 'text-foreground'
                            }`}>{player.points} pts</div>
                            <div className={`text-sm ${
                              index === 0 ? 'text-white/80' : 'text-foreground/60'
                            }`}>{player.totalScores} total</div>
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

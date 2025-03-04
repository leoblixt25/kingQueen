import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AdminLogin } from "@/components/AdminLogin";
import { PlayerManagement } from "@/components/PlayerManagement";
import { FinalMatch } from "@/components/FinalMatch";
import { MatchDisplay } from "@/components/MatchDisplay";
import { Rankings } from "@/components/Rankings";
import { useVolleyballData } from "@/hooks/useVolleyballData";
import { useMatchScoring } from "@/hooks/useMatchScoring";
import { useFinalMatch } from "@/hooks/useFinalMatch";
import { usePlayerManagement } from "@/hooks/usePlayerManagement";
import { useAdminControls } from "@/hooks/useAdminControls";
import { useEffect } from "react";

export default function BeachVolleyballTracker() {
  const { toast } = useToast();
  
  // Use our custom hooks
  const {
    gender,
    setGender,
    players,
    femalePlayers,
    malePlayers,
    matches,
    setMatches,
    setPlayers,
    createInitialMatches,
    handleGenderChange,
    currentMatchIndex,
    setCurrentMatchIndex,
    score1,
    setScore1,
    score2,
    setScore2,
    handlePreviousMatch,
    handleNextMatch,
    updatePlayerPoints
  } = useVolleyballData();

  const { 
    handleScoreSubmit, 
    handleEditScore 
  } = useMatchScoring({
    matches,
    setMatches,
    currentMatchIndex,
    setCurrentMatchIndex,
    score1,
    score2,
    setScore1,
    setScore2,
    updatePlayerPoints,
    players
  });

  const {
    showFinalMatch,
    setShowFinalMatch,
    finalMatchScores,
    setFinalMatchScores,
    finalMatchSubmitted,
    isEditingFinalMatch,
    finalMatchWinner,
    handleFinalMatchSubmit,
    handleEditFinalMatch,
    handleFinalMatchEditSubmit,
    handleResetFinalMatch
  } = useFinalMatch();

  const {
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
  } = usePlayerManagement({
    players,
    setPlayers,
    gender,
    matches,
    setMatches,
    createInitialMatches
  });

  const {
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
  } = useAdminControls({
    gender,
    players,
    matches,
    setPlayers,
    createInitialMatches,
    setCurrentMatchIndex
  });
  
  const handleFinalMatchSubmitWrapper = () => {
    handleFinalMatchSubmit(malePlayers, femalePlayers);
  };

  const hasValidMatches = Array.isArray(matches) && matches.length > 0;

  useEffect(() => {
    console.log("Current matches:", matches);
    console.log("Current index:", currentMatchIndex);
    console.log("Has valid matches:", hasValidMatches);
  }, [matches, currentMatchIndex, hasValidMatches]);

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
                handleFinalMatchSubmit={handleFinalMatchSubmitWrapper}
                handleEditFinalMatch={handleEditFinalMatch}
                handleResetFinalMatch={handleResetFinalMatch}
                handleFinalMatchEditSubmit={handleFinalMatchEditSubmit}
              />
            ) : (
              <>
                {hasValidMatches && matches[currentMatchIndex] ? (
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

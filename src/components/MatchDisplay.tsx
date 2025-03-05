import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { Match } from "@/types";
import { useEffect, useState, useCallback } from "react";

interface MatchDisplayProps {
  match: Match;
  currentMatchIndex: number;
  matches: Match[];
  score1: string;
  score2: string;
  isAdmin: boolean;
  setScore1: (score: string) => void;
  setScore2: (score: string) => void;
  handlePreviousMatch: () => void;
  handleNextMatch: () => void;
  handleScoreSubmit: () => void;
  handleEditScore: (matchIndex: number, newScore1: number, newScore2: number) => void;
}

export function MatchDisplay({
  match,
  currentMatchIndex,
  matches,
  score1,
  score2,
  isAdmin,
  setScore1,
  setScore2,
  handlePreviousMatch,
  handleNextMatch,
  handleScoreSubmit,
  handleEditScore,
}: MatchDisplayProps) {
  // Add local state to track if there was a recent submission and navigation
  const [navigationBlocked, setNavigationBlocked] = useState(false);

  console.log("MatchDisplay rendering with currentMatchIndex:", currentMatchIndex, "and matches length:", matches?.length);

  // Update score inputs when match changes
  useEffect(() => {
    if (match) {
      setScore1(String(match.score1));
      setScore2(String(match.score2));
      
      // Allow navigation immediately if match is already submitted
      if (match.isSubmitted) {
        setNavigationBlocked(false);
      }
    }
  }, [match, setScore1, setScore2]);

  // Handle case when match is undefined
  if (!match || !matches || matches.length === 0) {
    console.log("No match or matches available:", {
      matchExists: !!match,
      matchesLength: matches?.length || 0,
      currentMatchIndex,
    });
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg mb-8">
        <p className="text-lg text-gray-600">No match selected. Please navigate to another match or add players.</p>
      </div>
    );
  }

  // Calculate navigation status locally for reliable checking
  const hasPreviousMatch = currentMatchIndex > 0;
  const hasNextMatch = currentMatchIndex < matches.length - 1;

  console.log("Navigation status in MatchDisplay:", {
    hasPreviousMatch,
    hasNextMatch,
    currentMatchIndex,
    matchesLength: matches.length,
    isSubmitted: match.isSubmitted,
    navigationBlocked
  });

  // Create memoized handlers to avoid recreation on each render
  const handlePreviousClick = useCallback(() => {
    if (navigationBlocked) {
      console.log("Navigation blocked, ignoring previous click");
      return;
    }
    console.log("Previous button clicked, calling handlePreviousMatch");
    handlePreviousMatch();
  }, [handlePreviousMatch, navigationBlocked]);

  const handleNextClick = useCallback(() => {
    if (navigationBlocked) {
      console.log("Navigation blocked, ignoring next click");
      return;
    }
    console.log("Next button clicked, calling handleNextMatch");
    handleNextMatch();
  }, [handleNextMatch, navigationBlocked]);

  const handleSubmitClick = useCallback(() => {
    console.log("Submit button clicked, calling handleScoreSubmit");
    setNavigationBlocked(true); // Block navigation during submission
    handleScoreSubmit();

    // After 1.5 seconds, re-enable navigation
    setTimeout(() => {
      setNavigationBlocked(false);
      console.log("Navigation re-enabled after submission timeout");
    }, 1500);
  }, [handleScoreSubmit]);

  return (
    <Card className="mb-8 max-w-2xl mx-auto">
      <CardHeader>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold">
            Match {currentMatchIndex + 1} of {matches.length}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePreviousClick}
            disabled={!hasPreviousMatch || navigationBlocked}
            className="flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <div className="flex-1 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold text-center">
                {match.player1.name} & {match.player2.name}
              </p>
              {!match.isSubmitted || isAdmin ? (
                <Input
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin} // Disable if submitted and not admin
                />
              ) : (
                <p className="text-xl font-bold">{match.score1}</p>
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold text-center">
                {match.player3.name} & {match.player4.name}
              </p>
              {!match.isSubmitted || isAdmin ? (
                <Input
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin} // Disable if submitted and not admin
                />
              ) : (
                <p className="text-xl font-bold">{match.score2}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleNextClick}
            disabled={!hasNextMatch || navigationBlocked}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        {!match.isSubmitted ? (
          <div className="flex justify-center">
            <Button 
              onClick={handleSubmitClick} 
              className="w-full sm:w-auto"
              disabled={navigationBlocked}
            >
              Submit Score
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Check className="text-green-500 w-6 h-6" />
            <p className="text-lg">Final Score: {match.score1} - {match.score2}</p>
          </div>
        )}

        {isAdmin && match.isSubmitted && (
          <div className="flex justify-center">
            <Button
              onClick={() => handleEditScore(currentMatchIndex, parseInt(score1, 10) || 0, parseInt(score2, 10) || 0)}
              variant="outline"
              disabled={navigationBlocked}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
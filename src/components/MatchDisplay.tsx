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
  // Initialize state for the submission flag
  const [recentSubmission, setRecentSubmission] = useState(false);

  // Ensure score inputs are updated when the match changes
  useEffect(() => {
    if (match) {
      setScore1(String(match.score1));
      setScore2(String(match.score2));
    }
  }, [match, setScore1, setScore2]);

  // Ensure that after submission, navigation is not blocked, and we can move to other matches
  useEffect(() => {
    if (recentSubmission) {
      const timer = setTimeout(() => {
        setRecentSubmission(false); // Reset the submission flag
      }, 1500); // Let the submission "lock" for a short period
      return () => clearTimeout(timer); // Cleanup the timer
    }
  }, [recentSubmission]);

  // Handle case when no match is selected
  if (!match || !matches || matches.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg mb-8">
        <p className="text-lg text-gray-600">No match selected. Please navigate to another match or add players.</p>
      </div>
    );
  }

  // Calculate navigation status based on the current index
  const hasPreviousMatch = currentMatchIndex > 0;
  const hasNextMatch = currentMatchIndex < matches.length - 1;

  // Memoized handlers for navigation
  const handlePreviousClick = useCallback(() => {
    handlePreviousMatch(); // Navigate to the previous match
  }, [handlePreviousMatch]);

  const handleNextClick = useCallback(() => {
    handleNextMatch(); // Navigate to the next match
  }, [handleNextMatch]);

  const handleSubmitClick = useCallback(() => {
    setRecentSubmission(true);
    handleScoreSubmit(); // Submit the score and mark the match as submitted
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
            disabled={!hasPreviousMatch} // Disabled if no previous match
            className="flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <div className="flex-1 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold text-center">
                {match.player1.name} & {match.player2.name}
              </p>
              {match.isSubmitted && !isAdmin ? (
                <p className="text-xl font-bold">{match.score1}</p>
              ) : (
                <Input
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin} // Disable if submitted and not admin
                />
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold text-center">
                {match.player3.name} & {match.player4.name}
              </p>
              {match.isSubmitted && !isAdmin ? (
                <p className="text-xl font-bold">{match.score2}</p>
              ) : (
                <Input
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin} // Disable if submitted and not admin
                />
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleNextClick}
            disabled={!hasNextMatch} // Disabled if no next match
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
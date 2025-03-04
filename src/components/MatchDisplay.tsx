import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { Match } from "@/types";
import { useEffect, useState } from "react";

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
  // Add local state to track if there was a recent submission
  const [recentSubmission, setRecentSubmission] = useState(false);

  // Update score inputs when match changes
  useEffect(() => {
    if (match) {
      console.log("Match changed in MatchDisplay:", {
        matchIndex: currentMatchIndex,
        matchesLength: matches?.length,
        isSubmitted: match.isSubmitted,
        score1: match.score1,
        score2: match.score2,
        recentSubmission,
      });

      // Always set the scores to the match values, regardless of submission status
      setScore1(String(match.score1));
      setScore2(String(match.score2));
    }

    // Reset recent submission flag after a short delay
    if (recentSubmission) {
      const timer = setTimeout(() => {
        setRecentSubmission(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [match, setScore1, setScore2, currentMatchIndex, recentSubmission]);

  // Handle case when match is undefined
  if (!match || !matches || matches.length === 0) {
    console.log("No match or matches available:", {
      match,
      matchesLength: matches?.length || 0,
      currentMatchIndex,
    });
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg mb-8">
        <p className="text-lg text-gray-600">No match selected. Please navigate to another match or add players.</p>
      </div>
    );
  }

  // Calculate navigation status locally, don't rely solely on the props
  const hasPreviousMatch = currentMatchIndex > 0;
  const hasNextMatch = currentMatchIndex < matches.length - 1;

  console.log("Navigation status in MatchDisplay:", {
    hasPreviousMatch,
    hasNextMatch,
    currentMatchIndex,
    matchesLength: matches.length,
    isSubmitted: match.isSubmitted,
  });

  const handlePreviousClick = () => {
    console.log("Previous button clicked, calling handlePreviousMatch");
    handlePreviousMatch();
  };

  const handleNextClick = () => {
    console.log("Next button clicked, calling handleNextMatch");
    handleNextMatch();
  };

  const handleSubmitClick = () => {
    console.log("Submit button clicked, calling handleScoreSubmit");
    setRecentSubmission(true);
    handleScoreSubmit();
  };

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
            disabled={!hasPreviousMatch}
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
            disabled={!hasNextMatch}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        {!match.isSubmitted ? (
          <div className="flex justify-center">
            <Button onClick={handleSubmitClick} className="w-full sm:w-auto">
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
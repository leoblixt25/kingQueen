
import { Match } from "@/types";
import { useEffect, useState } from "react";
import { MatchNavigation } from "./MatchNavigation";
import { MatchTeams } from "./MatchTeams";
import { MatchControls } from "./MatchControls";
import { MatchResult } from "./MatchResult";

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
  const [recentSubmission, setRecentSubmission] = useState(false);
  const [navigationBlocked, setNavigationBlocked] = useState(false);

  console.log("MatchDisplay rendering with currentMatchIndex:", currentMatchIndex, "and matches length:", matches?.length);

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
        navigationBlocked
      });

      // Always set the scores to the match values
      setScore1(String(match.score1));
      setScore2(String(match.score2));
      
      // Allow navigation immediately if match is already submitted
      if (match.isSubmitted) {
        setNavigationBlocked(false);
      }
    }

    // Reset recent submission flag after a delay
    if (recentSubmission) {
      const timer = setTimeout(() => {
        setRecentSubmission(false);
        setNavigationBlocked(false); // Re-enable navigation
        console.log("Navigation re-enabled after submission timeout");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [match, setScore1, setScore2, currentMatchIndex, recentSubmission, matches?.length, navigationBlocked]);

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

  const onSubmitClick = () => {
    console.log("Submit button clicked, calling handleScoreSubmit");
    setRecentSubmission(true);
    setNavigationBlocked(true); // Block navigation during submission
    console.log("Navigation blocked for submission");
    handleScoreSubmit();
  };

  return (
    <MatchNavigation
      currentMatchIndex={currentMatchIndex}
      matchesCount={matches.length}
      hasPreviousMatch={hasPreviousMatch}
      hasNextMatch={hasNextMatch}
      navigationBlocked={navigationBlocked}
      handlePreviousMatch={handlePreviousMatch}
      handleNextMatch={handleNextMatch}
    >
      <MatchTeams
        match={match}
        isSubmitted={match.isSubmitted}
        isAdmin={isAdmin}
        score1={score1}
        score2={score2}
        setScore1={setScore1}
        setScore2={setScore2}
      />
      
      {!match.isSubmitted ? (
        <MatchControls 
          onSubmitClick={onSubmitClick} 
          navigationBlocked={navigationBlocked} 
        />
      ) : (
        <MatchResult 
          score1={match.score1} 
          score2={match.score2} 
          isAdmin={isAdmin}
          navigationBlocked={navigationBlocked}
          onEditScore={() => handleEditScore(currentMatchIndex, parseInt(score1, 10) || 0, parseInt(score2, 10) || 0)}
        />
      )}
    </MatchNavigation>
  );
}

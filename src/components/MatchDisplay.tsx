
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { Match } from "@/types";

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
  return (
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
                {match.player1.name} & {match.player2.name}
              </p>
              {!match.isSubmitted || isAdmin ? (
                <Input
                  value={match.isSubmitted && !isAdmin ? match.score1 : score1}
                  onChange={(e) => setScore1(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin}
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
                  value={match.isSubmitted && !isAdmin ? match.score2 : score2}
                  onChange={(e) => setScore2(e.target.value)}
                  type="number"
                  className="w-20 text-center"
                  inputMode="numeric"
                  pattern="\d*"
                  disabled={match.isSubmitted && !isAdmin}
                />
              ) : (
                <p className="text-xl font-bold">{match.score2}</p>
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

        {!match.isSubmitted ? (
          <div className="flex justify-center">
            <Button onClick={handleScoreSubmit} className="w-full sm:w-auto">
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

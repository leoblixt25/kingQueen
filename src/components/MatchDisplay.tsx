
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { Match } from "@/types";

interface MatchDisplayProps {
  match: Match;
  matchIndex: number;
  score1: string;
  score2: string;
  isAdmin: boolean;
  onScore1Change: (value: string) => void;
  onScore2Change: (value: string) => void;
  onSubmit: () => void;
  onEdit: (matchIndex: number, score1: number, score2: number) => void;
}

export function MatchDisplay({
  match,
  matchIndex,
  score1,
  score2,
  isAdmin,
  onScore1Change,
  onScore2Change,
  onSubmit,
  onEdit,
}: MatchDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Match {matchIndex + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-lg font-semibold">{match.player1.name} & {match.player2.name}</p>
          </div>
          {!match.isSubmitted || isAdmin ? (
            <Input
              value={match.isSubmitted && !isAdmin ? match.score1 : score1}
              onChange={(e) => onScore1Change(e.target.value)}
              type="number"
              className="w-16"
              inputMode="numeric"
              pattern="\d*"
              step="any"
              disabled={match.isSubmitted && !isAdmin}
            />
          ) : (
            <p>{match.score1}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-lg font-semibold">{match.player3.name} & {match.player4.name}</p>
          </div>
          {!match.isSubmitted || isAdmin ? (
            <Input
              value={match.isSubmitted && !isAdmin ? match.score2 : score2}
              onChange={(e) => onScore2Change(e.target.value)}
              type="number"
              className="w-16"
              inputMode="numeric"
              pattern="\d*"
              step="any"
              disabled={match.isSubmitted && !isAdmin}
            />
          ) : (
            <p>{match.score2}</p>
          )}
        </div>
        {!match.isSubmitted ? (
          <div className="flex items-center space-x-4">
            <Button onClick={onSubmit}>Submit</Button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <p>Match Score: {match.score1} - {match.score2}</p>
            <Check className="text-green-500" />
          </div>
        )}
        {isAdmin && (
          <div className="flex items-center space-x-4">
            <Button onClick={() => onEdit(matchIndex, parseInt(score1, 10) || 0, parseInt(score2, 10) || 0)}>
              Edit Score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

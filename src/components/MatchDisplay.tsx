import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { ResolvedMatch, Player } from "@/types";

interface MatchDisplayProps {
  match: ResolvedMatch;
  matchIndex: number;
  score1: string;
  score2: string;
  isAdmin: boolean;
  onScore1Change: (value: string) => void;
  onScore2Change: (value: string) => void;
  onSubmit: () => void;
}

// Helper to safely get player name - NO FALLBACKS, shows error if missing
const getPlayerName = (player: Player | null): string => {
  if (!player) return '❌ MISSING';
  return player.name;
};

export function MatchDisplay({
  match,
  matchIndex,
  score1,
  score2,
  isAdmin,
  onScore1Change,
  onScore2Change,
  onSubmit,
}: MatchDisplayProps) {
  // Extract teams from standardized structure
  const [teamA1, teamA2] = match.teamA;
  const [teamB1, teamB2] = match.teamB;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match {matchIndex + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <p className="text-lg font-semibold">
            {getPlayerName(teamA1)} & {getPlayerName(teamA2)}
          </p>
          {!match.isSubmitted || isAdmin ? (
            <Input
              type="number"
              className="w-16"
              value={score1}
              onChange={(e) => onScore1Change(e.target.value)}
              disabled={match.isSubmitted}
            />
           ) : (
            <p>{match.score1}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <p className="text-lg font-semibold">
            {getPlayerName(teamB1)} & {getPlayerName(teamB2)}
          </p>
          {!match.isSubmitted || isAdmin ? (
            <Input
              type="number"
              className="w-16"
              value={score2}
              onChange={(e) => onScore2Change(e.target.value)}
              disabled={match.isSubmitted}
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
            <p>
              Final Score: {match.score1} - {match.score2}
            </p>
            <Check className="text-green-500" />
          </div>
        )}

      </CardContent>
    </Card>
  );
}

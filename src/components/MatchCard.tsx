import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

interface MatchCardProps {
  match: Match;
  isAdmin: boolean;
  onScoreSubmit: (score1: number, score2: number) => void;
}

export function MatchCard({ match, isAdmin, onScoreSubmit }: MatchCardProps) {
  const [score1, setScore1] = useState(match.score1);
  const [score2, setScore2] = useState(match.score2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-lg font-semibold">{match.player1.name} & {match.player2.name}</p>
          </div>
          <Input
            type="number"
            className="w-16"
            value={score1}
            onChange={(e) => setScore1(parseInt(e.target.value, 10) || 0)}
            disabled={!isAdmin}
          />
        </div>
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-lg font-semibold">{match.player3.name} & {match.player4.name}</p>
          </div>
          <Input
            type="number"
            className="w-16"
            value={score2}
            onChange={(e) => setScore2(parseInt(e.target.value, 10) || 0)}
            disabled={!isAdmin}
          />
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={() => onScoreSubmit(score1, score2)}>
            {match.isSubmitted ? <Check className="text-green-500" /> : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

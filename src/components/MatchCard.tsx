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
            defaultValue={match.score1}
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
            defaultValue={match.score2}
            disabled={!isAdmin}
          />
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={() => onScoreSubmit(match.score1, match.score2)}>
            {match.isSubmitted ? <Check className="text-green-500" /> : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


import { useState } from "react";
import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface MatchCardProps {
  match: Match;
  onScoreSubmit: (matchId: number, scoreA: number, scoreB: number) => void;
  isAdmin?: boolean;
}

const MatchCard = ({ match, onScoreSubmit, isAdmin = false }: MatchCardProps) => {
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() || "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() || "");

  const handleSubmit = () => {
    const parsedScoreA = parseInt(scoreA);
    const parsedScoreB = parseInt(scoreB);
    
    if (!isNaN(parsedScoreA) && !isNaN(parsedScoreB)) {
      onScoreSubmit(match.id, parsedScoreA, parsedScoreB);
    }
  };

  const isWinner = (score: number | undefined, otherScore: number | undefined) => {
    return score !== undefined && otherScore !== undefined && score > otherScore;
  };

  return (
    <Card className="p-4 mb-4 animate-slide-up">
      <div className="text-sm font-medium mb-2">Match #{match.id}</div>
      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{match.teamA[0]}</span>
            {isWinner(match.scoreA, match.scoreB) && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{match.teamA[1]}</span>
            {isWinner(match.scoreA, match.scoreB) && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
        </div>
        
        <div className="flex space-x-2 justify-center items-center">
          <Input
            type="number"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className="w-16 text-center"
            placeholder="0"
            disabled={match.submitted && !isAdmin}
          />
          <span className="text-sm font-medium">vs</span>
          <Input
            type="number"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className="w-16 text-center"
            placeholder="0"
            disabled={match.submitted && !isAdmin}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{match.teamB[0]}</span>
            {isWinner(match.scoreB, match.scoreA) && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{match.teamB[1]}</span>
            {isWinner(match.scoreB, match.scoreA) && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
        </div>
      </div>
      
      {(!match.submitted || isAdmin) && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            size="sm"
            className="transition-all duration-300 transform hover:scale-105"
          >
            {isAdmin && match.submitted ? "Update Score" : "Submit Score"}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default MatchCard;

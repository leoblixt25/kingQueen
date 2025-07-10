import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { Match } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { updatePlayerPointsFromMatch } from "@/utils/playerUtils";

interface MatchDisplayProps {
  match: Match;
  matchIndex: number;
  score1: string;
  score2: string;
  isAdmin: boolean;
  onScore1Change: (value: string) => void;
  onScore2Change: (value: string) => void;
  onSubmit: () => void;
  onRefresh?: () => void; // Optional prop to refetch data
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
  onRefresh,
}: MatchDisplayProps) {
  const [localScore1, setLocalScore1] = useState(score1);
  const [localScore2, setLocalScore2] = useState(score2);
  const [isSaving, setIsSaving] = useState(false);

  const handleAdminEdit = async () => {
    const parsedScore1 = parseInt(localScore1, 10);
    const parsedScore2 = parseInt(localScore2, 10);

    if (isNaN(parsedScore1) || isNaN(parsedScore2)) {
      alert("Scores must be valid numbers");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({
          score1: parsedScore1,
          score2: parsedScore2,
          is_submitted: true,
        })
        .eq("id", match.id);

      if (error) {
        console.error("Error updating match:", error);
        alert("Failed to update match scores.");
        return;
      }

      await updatePlayerPointsFromMatch(match.id, parsedScore1, parsedScore2, true);
      if (onRefresh) onRefresh();

      alert("Match score updated and player stats recalculated.");
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An error occurred while updating.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match {matchIndex + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <p className="text-lg font-semibold">
            {match.player1.name} & {match.player2.name}
          </p>
          {!match.isSubmitted || isAdmin ? (
            <Input
              type="number"
              className="w-16"
              value={isAdmin ? localScore1 : score1}
              onChange={(e) =>
                isAdmin ? setLocalScore1(e.target.value) : onScore1Change(e.target.value)
              }
          disabled={match.isSubmitted && !isAdmin}
            />
           ) : (
            <p>{match.score1}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <p className="text-lg font-semibold">
            {match.player3.name} & {match.player4.name}
          </p>
          {!match.isSubmitted || isAdmin ? (
            <Input
              type="number"
              className="w-16"
              value={isAdmin ? localScore2 : score2}
              onChange={(e) =>
                isAdmin ? setLocalScore2(e.target.value) : onScore2Change(e.target.value)
              }
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
            <p>
              Final Score: {match.score1} - {match.score2}
            </p>
            <Check className="text-green-500" />
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center space-x-4">
            <Button onClick={handleAdminEdit} disabled={isSaving}>
              Edit Score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

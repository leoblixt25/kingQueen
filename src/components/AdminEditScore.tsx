import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { updatePlayerPointsFromMatch } from "@/utils/playerUtils";
import { Match } from "@/types";
import { toast } from "@/hooks/use-toast";

interface AdminEditScoreProps {
  match: Match & { id: string };
  matchIndex: number;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function AdminEditScore({ match, matchIndex, onClose, onSuccess }: AdminEditScoreProps) {
  const [score1, setScore1] = useState(match.score1.toString());
  const [score2, setScore2] = useState(match.score2.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const parsedScore1 = parseInt(score1, 10);
    const parsedScore2 = parseInt(score2, 10);

    if (isNaN(parsedScore1) || isNaN(parsedScore2)) {
      toast({
        title: "Invalid Input",
        description: "Scores must be valid numbers",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update match score
      const { error: matchError } = await supabase
        .from("matches")
        .update({
          score1: parsedScore1,
          score2: parsedScore2,
          is_submitted: true,
        })
        .eq("id", match.id);

      if (matchError) {
        console.error("Error updating match:", matchError);
        toast({
          title: "Update Failed",
          description: "Failed to update match scores",
          variant: "destructive",
        });
        return;
      }

      // Update player points (with edit flag)
      await updatePlayerPointsFromMatch(match.id, parsedScore1, parsedScore2, true);

      // Wait for parent component to handle success callback (which reloads data)
      await onSuccess();
      onClose();
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="fixed inset-4 z-50 bg-white border-2 border-blue-200 shadow-xl">
      <CardHeader>
        <CardTitle className="text-center">
          Edit Match {matchIndex + 1} Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label>Team 1: {match.player1.name} & {match.player2.name}</Label>
            <Input
              type="number"
              value={score1}
              onChange={(e) => setScore1(e.target.value)}
              className="text-center text-lg font-bold"
            />
          </div>
          <div>
            <Label>Team 2: {match.player3.name} & {match.player4.name}</Label>
            <Input
              type="number"
              value={score2}
              onChange={(e) => setScore2(e.target.value)}
              className="text-center text-lg font-bold"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? "Saving..." : "Save Score"}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isSaving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
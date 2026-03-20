import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { db } from "@/config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updatePlayerPointsFromMatch } from "@/utils/playerUtils";

interface MatchCardProps {
  match: Match;
  isAdmin: boolean;
  onScoreSubmit?: () => void; // Optional callback after successful submission
}

export function MatchCard({ match, isAdmin, onScoreSubmit }: MatchCardProps) {
  const [score1, setScore1] = useState<number | null>(match.score1 ?? 0);
  const [score2, setScore2] = useState<number | null>(match.score2 ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (score1 == null || score2 == null || isNaN(score1) || isNaN(score2)) {
      alert("Please enter valid scores.");
      return;
    }

    setIsSaving(true);

    try {
      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, {
        score1,
        score2,
        is_completed: true,
      });

      // Update player points using transaction
      await updatePlayerPointsFromMatch(match.id, score1, score2);
      if (onScoreSubmit) onScoreSubmit();

      alert("Match score and player rankings updated.");
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An error occurred during submission.");
    } finally {
      setIsSaving(false);
    }
  };

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
            value={score1 ?? ""}
            onChange={(e) => setScore1(parseInt(e.target.value, 10))}
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
            value={score2 ?? ""}
            onChange={(e) => setScore2(parseInt(e.target.value, 10))}
            disabled={!isAdmin}
          />
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={handleSubmit} disabled={isSaving}>
            {match.isSubmitted ? <Check className="text-green-500" /> : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

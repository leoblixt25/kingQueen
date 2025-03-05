
import { Button } from "@/components/ui/button";
import { Check, Edit } from "lucide-react";

interface MatchResultProps {
  score1: number;
  score2: number;
  isAdmin: boolean;
  navigationBlocked: boolean;
  onEditScore: () => void;
}

export function MatchResult({
  score1,
  score2,
  isAdmin,
  navigationBlocked,
  onEditScore
}: MatchResultProps) {
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <Check className="text-green-500 w-6 h-6" />
        <p className="text-lg">Final Score: {score1} - {score2}</p>
      </div>

      {isAdmin && (
        <div className="flex justify-center">
          <Button
            onClick={onEditScore}
            variant="outline"
            disabled={navigationBlocked}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Score
          </Button>
        </div>
      )}
    </>
  );
}

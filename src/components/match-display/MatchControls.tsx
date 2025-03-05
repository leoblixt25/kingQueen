
import { Button } from "@/components/ui/button";

interface MatchControlsProps {
  onSubmitClick: () => void;
  navigationBlocked: boolean;
}

export function MatchControls({ onSubmitClick, navigationBlocked }: MatchControlsProps) {
  return (
    <div className="flex justify-center">
      <Button 
        onClick={onSubmitClick} 
        className="w-full sm:w-auto"
        disabled={navigationBlocked}
      >
        Submit Score
      </Button>
    </div>
  );
}

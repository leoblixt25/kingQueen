
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface AdminControlsProps {
  onResetScores: () => void;
}

const AdminControls = ({ onResetScores }: AdminControlsProps) => {
  return (
    <div className="flex justify-end mb-4">
      <Button
        variant="destructive"
        onClick={onResetScores}
        className="transition-all duration-300 transform hover:scale-105"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Reset All Scores
      </Button>
    </div>
  );
};

export default AdminControls;

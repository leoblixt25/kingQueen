
import { Button } from "@/components/ui/button";
import { Trash2, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminControlsProps {
  onResetScores: () => void;
}

const AdminControls = ({ onResetScores }: AdminControlsProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={onResetScores}
          className="transition-all duration-300 transform hover:scale-105"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Reset All Scores
        </Button>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => navigate('/admin/settings')}
          className="bg-primary hover:bg-primary/90 text-white transition-all duration-300"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure Tournament
        </Button>
      </div>
    </div>
  );
};

export default AdminControls;

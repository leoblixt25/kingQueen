import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";

interface ScoreResetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isResetting: boolean;
}

export const ScoreResetConfirmationModal = ({ isOpen, onClose, onConfirm, isResetting }: ScoreResetConfirmationModalProps) => {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isResetting && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border-2 border-ocean/30 shadow-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-ocean/10 rounded-full">
            <RotateCcw className="w-8 h-8 text-ocean" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">
            Reset All Scores
          </DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed">
            This will clear all match scores and player points but keep player names and matchups.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isResetting}
            className="flex-1 bg-white/70 hover:bg-sand border-sand-dark/30 text-foreground font-semibold py-3 transition-all duration-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isResetting}
            className="flex-1 bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Reset
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

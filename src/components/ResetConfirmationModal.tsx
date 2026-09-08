import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ResetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isResetting: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
}

export const ResetConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isResetting,
  title = "Reset Tournament",
  description = "This will delete all players and scores. This action cannot be undone.",
  confirmText = "Confirm Reset"
}: ResetConfirmationModalProps) => {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isResetting && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border-2 border-coral/30 shadow-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-coral/10 rounded-full">
            <AlertTriangle className="w-8 h-8 text-coral" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed">
            {description}
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={isResetting}
            className="flex-1 bg-coral hover:bg-coral-dark text-white font-semibold py-3 transition-all duration-300"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

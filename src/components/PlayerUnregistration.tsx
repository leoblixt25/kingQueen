import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Mail, UserX } from "lucide-react";

interface PlayerUnregistrationProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function PlayerUnregistration({ onClose, onSuccess }: PlayerUnregistrationProps) {
  const [email, setEmail] = useState("");
  const [isUnregistering, setIsUnregistering] = useState(false);

  const handleUnregister = async () => {
    if (!email.trim()) {
      toast({
        title: "Missing Email",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsUnregistering(true);

    try {
      // Check if player can unregister
      const { data: canUnregister, error: checkError } = await supabase
        .rpc('can_unregister', { player_email: email.toLowerCase() });

      if (checkError) {
        console.error('Error checking unregistration eligibility:', checkError);
        toast({
          title: "Error",
          description: "Failed to check registration status",
          variant: "destructive",
        });
        return;
      }

      if (!canUnregister) {
        toast({
          title: "Cannot Unregister",
          description: "Registration cannot be cancelled at this time. Either you're not registered or it's too close to the tournament date.",
          variant: "destructive",
        });
        return;
      }

      // Find and remove the player
      const { data: player, error: findError } = await supabase
        .from('players')
        .select('id, name')
        .eq('email', email.toLowerCase())
        .eq('is_confirmed', true)
        .single();

      if (findError || !player) {
        toast({
          title: "Player Not Found",
          description: "No confirmed registration found for this email address",
          variant: "destructive",
        });
        return;
      }

      // Confirm unregistration
      if (!window.confirm(`Are you sure you want to cancel your registration for the tournament?`)) {
        return;
      }

      // Remove the player
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id);

      if (deleteError) {
        console.error('Error unregistering player:', deleteError);
        toast({
          title: "Unregistration Failed",
          description: "Failed to cancel registration. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Registration Cancelled",
        description: "Your tournament registration has been cancelled successfully.",
      });

      onSuccess();
      onClose();

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUnregistering(false);
    }
  };

  return (
    <div className="fixed inset-4 z-50 bg-white border-2 border-coral-200 shadow-xl rounded-lg">
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-center flex-1 text-coral font-bold flex items-center justify-center gap-2">
              <UserX className="w-5 h-5" />
              Cancel Registration
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-sand-light rounded-full transition-colors"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-coral/30 bg-coral/10">
            <AlertTriangle className="h-4 w-4 text-coral" />
            <AlertDescription className="text-coral-dark">
              <strong>Warning:</strong> This action cannot be undone. You will need to re-register if you change your mind.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unregisterEmail" className="text-foreground font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="unregisterEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-coral"
                placeholder="Enter your registered email"
              />
            </div>

            <div className="p-4 bg-sand-light/50 rounded-lg border border-sand-dark/20">
              <h4 className="font-semibold text-foreground mb-2">Cancellation Policy:</h4>
              <ul className="text-sm text-foreground/70 space-y-1">
                <li>• Registration can only be cancelled up to 3 days before the tournament</li>
                <li>• Your spot will become available for other players</li>
                <li>• You will receive a confirmation email once cancelled</li>
                <li>• You can re-register if spots are still available</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleUnregister}
              disabled={isUnregistering}
              variant="destructive"
              className="flex-1 touch-target transition-all duration-300"
            >
              {isUnregistering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Cancel Registration
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isUnregistering}
              className="flex-1 touch-target bg-white/70 hover:bg-sand hover:text-sand-dark border-sand-dark/30 text-sand-dark transition-all duration-300"
            >
              Keep Registration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initializeTournamentDatabase, checkDatabaseStatus } from "@/utils/tournamentInit";
import { emergencyFix } from "@/utils/emergencyFix";
import { Database, Play, CheckCircle, AlertTriangle } from "lucide-react";

export function DatabaseInit() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeTournamentDatabase();
      
      // Check status after initialization
      await handleCheckStatus();
    } catch (error) {
      console.error('Initialization error:', error);
      toast({
        title: "Initialization Failed",
        description: "Please check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const result = await checkDatabaseStatus();
      setStatus(result);
      console.log('Database status:', result);
    } catch (error) {
      console.error('Status check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleEmergencyFix = async () => {
    setIsFixing(true);
    try {
      await emergencyFix();
      
      // Check status after fix
      await handleCheckStatus();
    } catch (error) {
      console.error('Emergency fix error:', error);
      toast({
        title: "Emergency Fix Failed",
        description: "Please check console for details. You may need to check your database schema.",
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-ocean">
            <Database className="w-6 h-6" />
            Database Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-foreground/70">
            Initialize the tournament database with placeholder players
          </div>
          
          <Button
            onClick={handleInitialize}
            disabled={isInitializing || isFixing}
            className="w-full bg-ocean hover:bg-ocean-dark text-white"
          >
            {isInitializing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Initializing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Initialize Tournament Database
              </>
            )}
          </Button>

          <Button
            onClick={handleEmergencyFix}
            disabled={isFixing || isInitializing}
            variant="destructive"
            className="w-full"
          >
            {isFixing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Fixing...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emergency Fix
              </>
            )}
          </Button>

          <Button
            onClick={handleCheckStatus}
            disabled={isChecking || isInitializing || isFixing}
            variant="outline"
            className="w-full"
          >
            {isChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-ocean/30 border-t-ocean rounded-full animate-spin mr-2" />
                Checking...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Check Database Status
              </>
            )}
          </Button>

          {status && (
            <div className="mt-4 p-3 bg-palm/10 rounded-lg text-sm">
              <div className="font-semibold text-palm mb-2">Current Status:</div>
              <div>Total Players: {status.totalPlayers}</div>
              <div>Confirmed: {status.confirmedPlayers}</div>
              <div>Male: {status.maleCount}/8</div>
              <div>Female: {status.femaleCount}/8</div>
            </div>
          )}

          <div className="text-xs text-foreground/60 text-center">
            This will create 16 placeholder players (8 male, 8 female) ready for registration.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
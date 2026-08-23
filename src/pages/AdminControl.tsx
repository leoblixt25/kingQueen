import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { db } from "@/config/firebase";
import { collection, getDocs, query, orderBy, limit, doc, setDoc, getDoc, updateDoc, where } from "firebase/firestore";
import { signOut } from "@/utils/authUtils";
import { LogOut, Save, Crown, Users, AlertTriangle, Settings, RotateCcw, Trash, PowerOff, UserX } from "lucide-react";
import { useTournamentFinished } from "@/hooks/useTournamentFinished";
import { ResetConfirmationModal } from "@/components/ResetConfirmationModal";
import { resetScoresOnly, deleteFirebaseAuthUsers } from "@/utils/resetUtils";
import { PlayerReplacer } from "@/components/PlayerReplacer";
import { AdminPanel } from "@/components/AdminPanel";
import { loadMatches } from "@/utils/firebaseUtils";
import { buildPlayersMap, resolveMatchPlayers } from "@/utils/matchPlayerResolver";
import { Player } from "@/types";

interface TournamentSettings {
  id?: string;
  tournament_date: string;
  tournament_city: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
}

export default function AdminControl() {
  const navigate = useNavigate();
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentCity, setTournamentCity] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [registrationCutoff, setRegistrationCutoff] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingSettingsId, setExistingSettingsId] = useState<string | null>(null);
  const [playerCounts, setPlayerCounts] = useState<{ maleCount: number; femaleCount: number } | null>(null);
  const [showTournamentConfig, setShowTournamentConfig] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showScoreResetModal, setShowScoreResetModal] = useState(false);
  const [isResettingScores, setIsResettingScores] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPlayerReplacer, setShowPlayerReplacer] = useState(false);
  const tournamentFinished = useTournamentFinished();
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isDeletingPlayers, setIsDeletingPlayers] = useState(false);
  const [femalePlayers, setFemalePlayers] = useState<any[]>([]);
  const [malePlayers, setMalePlayers] = useState<any[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<any[]>([]);
  const [maleMatches, setMaleMatches] = useState<any[]>([]);

  useEffect(() => {
    loadTournamentSettings();
    loadPlayers();
  }, []);

  // Load matches only when AdminPanel opens (lazy loading)
  useEffect(() => {
    if (showAdminPanel) {
      loadMatchesData();
    }
  }, [showAdminPanel]);

  const loadTournamentSettings = async () => {
    try {
      console.log('=== LOAD STARTED ===');
      // Use a fixed document ID for settings
      const settingsRef = doc(db, 'tournamentSettings', 'default_settings');
      const snapshot = await getDoc(settingsRef);
      
      console.log('Document exists?', snapshot.exists());
      
      if (snapshot.exists()) {
        const data = snapshot.data() as TournamentSettings;
        console.log('Loaded settings:', data);
        console.log('City from Firebase:', data.tournament_city);
        setTournamentDate(data.tournament_date);
        setTournamentCity(data.tournament_city || '');
        setMaxPlayers(data.max_players_per_gender || 8);
        setRegistrationCutoff(data.registration_cutoff_days || 3);
        setExistingSettingsId('default_settings');
        console.log('Set existingSettingsId to: default_settings');
      } else {
        console.log('No settings found, using defaults');
        // Set default values if no settings exist
        setTournamentDate(new Date().toISOString().split('T')[0]);
        setTournamentCity('Da Nang');
        setMaxPlayers(8);
        setRegistrationCutoff(3);
        setExistingSettingsId('default_settings');
      }
      console.log('=== LOAD COMPLETED ===');
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load tournament settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      loadPlayerCounts();
    }
  };

  const loadPlayerCounts = async () => {
    try {
      const playersRef = collection(db, 'players');
      const snapshot = await getDocs(query(playersRef, where('status', '==', 'approved')));
      const players = snapshot.docs.map(doc => doc.data() as any);
      
      if (players) {
        const maleCount = players.filter((p: any) => p.gender === 'male').length;
        const femaleCount = players.filter((p: any) => p.gender === 'female').length;
        setPlayerCounts({ maleCount, femaleCount });
      }
    } catch (error) {
      console.error('Error loading player counts:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const playersRef = collection(db, 'players');
      const snapshot = await getDocs(query(playersRef, where('status', '==', 'approved')));
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const female = players.filter((p: any) => p.gender === 'female');
      const male = players.filter((p: any) => p.gender === 'male');

      setFemalePlayers(female);
      setMalePlayers(male);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const loadMatchesData = async () => {
    try {
      // Get fresh player data first for resolving
      const playersRef = collection(db, 'players');
      const snapshot = await getDocs(query(playersRef, where('status', '==', 'approved')));
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));

      const female = players.filter((p: any) => p.gender === 'female');
      const male = players.filter((p: any) => p.gender === 'male');

      // Build players map for resolving match player IDs
      const playersMap = buildPlayersMap(female, male);

      // Load matches and resolve player IDs to Player objects
      const { femaleMatches, maleMatches } = await loadMatches();
      const resolvedFemale = resolveMatchPlayers(femaleMatches, playersMap);
      const resolvedMale = resolveMatchPlayers(maleMatches, playersMap);

      setFemaleMatches(resolvedFemale);
      setMaleMatches(resolvedMale);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      console.log('=== SAVE STARTED ===');
      console.log('Current city value:', tournamentCity);
      console.log('Current date value:', tournamentDate);
      console.log('Existing settings ID:', existingSettingsId);
      
      const settingsData = {
        tournament_date: tournamentDate,
        tournament_city: tournamentCity,
        max_players_per_gender: maxPlayers,
        registration_cutoff_days: registrationCutoff,
        updated_at: new Date().toISOString(),
      };

      console.log('Full settings data to save:', settingsData);

      // Always use the fixed document ID
      const settingsRef = doc(db, 'tournamentSettings', 'default_settings');
      await setDoc(settingsRef, settingsData, { merge: true });
      setExistingSettingsId('default_settings');
      console.log('✅ Saved settings to fixed document ID: default_settings');
      
      console.log('=== SAVE COMPLETED ===');

      toast({
        title: "Success",
        description: "Tournament settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save tournament settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const handleResetEverything = async () => {
    console.log('🔄 [FULL RESET] User clicked reset button, showing modal');
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    console.log('🔄 [FULL RESET] User confirmed reset via modal');
    setIsResetting(true);
    
    try {
      console.log('🔄 [FULL RESET] Starting reset process...');
      const { fullTournamentReset } = await import('@/utils/resetUtils');
      await fullTournamentReset();
      console.log('✅ [FULL RESET] Reset completed, waiting 3 seconds for Firebase to stabilize...');
      
      // Wait 3 seconds to allow Firebase to fully clear and reinitialize data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ [FULL RESET] Firebase stabilization complete');
      setShowResetModal(false);
      setIsResetting(false);
      
      toast({
        title: "Tournament Reset",
        description: "Tournament has been completely reset",
      });
      
      // Navigate to tournament page to see the fresh data
      navigate('/tournament');
    } catch (error) {
      console.error('❌ [FULL RESET] Error:', error);
      // Just close the modal and reset state - no error message
      setShowResetModal(false);
      setIsResetting(false);
      
      // Try to navigate anyway
      navigate('/tournament');
    }
  };

  const handleCloseResetModal = () => {
    if (!isResetting) {
      setShowResetModal(false);
    }
  };

  const handleResetScores = async () => {
    console.log('🔄 [SCORE RESET] User clicked reset scores button, showing modal');
    setShowScoreResetModal(true);
  };

  const handleConfirmScoreReset = async () => {
    console.log('🔄 [SCORE RESET] User confirmed score reset via modal');
    setIsResettingScores(true);
    
    try {
      console.log('🔄 [SCORE RESET] Starting score reset...');
      await resetScoresOnly();
      console.log('✅ [SCORE RESET] Scores reset completed');
      
      setShowScoreResetModal(false);
      setIsResettingScores(false);
      
      toast({
        title: "Scores Reset ✓",
        description: "All scores have been reset successfully",
      });
    } catch (error) {
      console.error('❌ [SCORE RESET] Score reset failed:', error);
      setIsResettingScores(false);
      toast({
        title: "Score Reset Failed",
        description: "Failed to reset scores. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloseScoreResetModal = () => {
    if (!isResettingScores) {
      setShowScoreResetModal(false);
    }
  };

  // Tournament Switch Off Mode: disable/restore public tournament pages.
  // Only writes one flag to the settings doc — no data is ever deleted.
  const handleSwitchOffTournament = async () => {
    if (!window.confirm('Are you sure you want to close this tournament? Public tournament pages will be disabled.')) return;
    setIsTogglingStatus(true);
    try {
      await setDoc(doc(db, 'tournamentSettings', 'settings'), { tournament_status: 'finished' }, { merge: true });
      toast({
        title: "Tournament Closed",
        description: "Public tournament pages are now disabled.",
      });
    } catch (error) {
      console.error('Error switching off tournament:', error);
      toast({
        title: "Error",
        description: "Failed to switch off tournament",
        variant: "destructive",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleRestoreAccess = async () => {
    setIsTogglingStatus(true);
    try {
      await setDoc(doc(db, 'tournamentSettings', 'settings'), { tournament_status: 'active' }, { merge: true });
      toast({
        title: "Tournament Restored",
        description: "Public tournament pages are available again.",
      });
    } catch (error) {
      console.error('Error restoring tournament access:', error);
      toast({
        title: "Error",
        description: "Failed to restore tournament access",
        variant: "destructive",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Delete all registered player accounts from Firebase Authentication
  // (server-side via Cloud Function — the admin account is never touched)
  const handleDeleteAllPlayers = async () => {
    const confirmed = window.confirm(
      'Warning: This will permanently remove all registered player accounts from Firebase Authentication. The admin account will not be deleted. Continue?'
    );
    if (!confirmed) return;

    setIsDeletingPlayers(true);
    try {
      const result = await deleteFirebaseAuthUsers();
      console.log('🗑️ [DELETE PLAYERS] Result:', result);
      if (result && (result as any).errorCount > 0) {
        toast({
          title: "Completed With Errors",
          description: `${(result as any).deletedCount} account(s) removed, ${(result as any).errorCount} failed. Failed deletions were logged.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "All registered player accounts have been removed. Admin account remains active.",
        });
      }
    } catch (error) {
      console.error('❌ [DELETE PLAYERS] Failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete player accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPlayers(false);
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce-gentle">⚙️</div>
          <p className="text-lg font-semibold">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center pt-6">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="mb-4 bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark transition-all duration-300 touch-target"
          >
            ← Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-2">
            Admin Control Panel
          </h1>
        </header>

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-palm">
              <Users className="w-5 h-5" />
              Current Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sunset/10 p-4 rounded-lg border border-sunset/20">
                <p className="text-sm text-foreground/60">Tournament Date</p>
                <p className="font-semibold">{new Date(tournamentDate).toLocaleDateString()}</p>
              </div>
              <div className="bg-ocean/10 p-4 rounded-lg border border-ocean/20">
                <p className="text-sm text-foreground/60">Max Players per Gender</p>
                <p className="font-semibold">{maxPlayers} Players</p>
              </div>
              <div className="bg-palm/10 p-4 rounded-lg border border-palm/20">
                <p className="text-sm text-foreground/60">Registration Cutoff</p>
                <p className="font-semibold">{registrationCutoff} Days</p>
              </div>
              <div className="bg-sand/10 p-4 rounded-lg border border-sand/20">
                <p className="text-sm text-foreground/60">Registered Players</p>
                <p className="font-semibold">
                  {playerCounts ? (
                    <>
                      <span className="block">Male: {playerCounts.maleCount}/{maxPlayers}</span>
                      <span className="block">Female: {playerCounts.femaleCount}/{maxPlayers}</span>
                    </>
                  ) : (
                    <span>Loading...</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => navigate('/tournament')}
          className="w-full bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Users className="w-4 h-4" />
          View Tournament
        </Button>

        {showTournamentConfig && (
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ocean">
              <Crown className="w-5 h-5" />
              Configure and manage the tournament
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tournamentDate">Tournament Date</Label>
                <input
                  id="tournamentDate"
                  type="date"
                  value={tournamentDate}
                  onChange={(e) => setTournamentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-sand-dark/30 rounded-md bg-white/70 focus:border-ocean focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tournamentCity">Tournament City</Label>
                <input
                  id="tournamentCity"
                  type="text"
                  placeholder="e.g., Da Nang"
                  value={tournamentCity}
                  onChange={(e) => setTournamentCity(e.target.value)}
                  className="w-full px-3 py-2 border border-sand-dark/30 rounded-md bg-white/70 focus:border-ocean focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPlayers">Max Players per Gender</Label>
                <Select value={maxPlayers.toString()} onValueChange={(value) => setMaxPlayers(Number(value))}>
                  <SelectTrigger className="bg-white/70 border-sand-dark/30 focus:border-ocean">
                    <SelectValue placeholder="Select player count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="8">8 Players</SelectItem>
                    <SelectItem value="12">12 Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationCutoff">Registration Cutoff (Days)</Label>
                <input
                  id="registrationCutoff"
                  type="number"
                  value={registrationCutoff}
                  onChange={(e) => setRegistrationCutoff(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-sand-dark/30 rounded-md bg-white/70 focus:border-ocean focus:outline-none"
                  min="1"
                  max="30"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-sand-dark/20">
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Admin Controls Section */}
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Settings className="w-5 h-5" />
              🔧 Admin Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tournament Switch Off Mode: status + switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-sand/10 border border-sand-dark/20">
              <span className="text-sm font-medium text-foreground/60">Tournament Status</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                tournamentFinished ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${tournamentFinished ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                {tournamentFinished ? 'Tournament Finished' : 'Active Tournament'}
              </span>
            </div>
            {tournamentFinished ? (
              <Button
                variant="outline"
                onClick={handleRestoreAccess}
                disabled={isTogglingStatus}
                className="w-full touch-target bg-white/70 hover:bg-palm hover:text-white border-palm/30 text-palm-dark transition-all duration-300"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${isTogglingStatus ? 'animate-spin' : ''}`} />
                Restore Tournament Access
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleSwitchOffTournament}
                disabled={isTogglingStatus}
                className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
              >
                <PowerOff className="w-4 h-4 mr-2" />
                Switch Off Tournament Mode
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowTournamentConfig(!showTournamentConfig)}
              className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark transition-all duration-300"
            >
              <Settings className="w-4 h-4 mr-2" />
              {showTournamentConfig ? 'Hide Configuration' : 'Configure Tournament'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdminPanel(true)}
              className="w-full touch-target bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark transition-all duration-300"
            >
              <Users className="w-4 h-4 mr-2" />
              Registration Panel
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPlayerReplacer(true)}
              className="w-full touch-target bg-white/70 hover:bg-palm hover:text-white border-palm/30 text-palm-dark transition-all duration-300"
            >
              <Users className="w-4 h-4 mr-2" />
              Replace Players
            </Button>
            <Button
              variant="outline"
              onClick={handleResetScores}
              className="w-full touch-target bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark transition-all duration-300"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Scores Only
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllPlayers}
              disabled={isDeletingPlayers}
              className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
            >
              {isDeletingPlayers ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Deleting Accounts...
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Delete All Registered Players
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetEverything}
              disabled={isResetting}
              className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
            >
              {isResetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4 mr-2" />
                  Reset Everything
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Modals */}
        <ResetConfirmationModal
          isOpen={showResetModal}
          onClose={handleCloseResetModal}
          onConfirm={handleConfirmReset}
          isResetting={isResetting}
        />

        <ResetConfirmationModal
          isOpen={showScoreResetModal}
          onClose={handleCloseScoreResetModal}
          onConfirm={handleConfirmScoreReset}
          isResetting={isResettingScores}
          title="Reset All Scores?"
          description="This will reset all match scores to 0. Players and match structure will be preserved. This action cannot be undone."
          confirmText="Reset Scores"
        />

        {showAdminPanel && (
          <AdminPanel
            onClose={() => setShowAdminPanel(false)}
            players={[
              ...femalePlayers.map(p => ({ ...p, gender: 'female' })),
              ...malePlayers.map(p => ({ ...p, gender: 'male' }))
            ]}
            femaleMatches={femaleMatches}
            maleMatches={maleMatches}
            tournamentDate={tournamentDate}
          />
        )}

        {showPlayerReplacer && (
          <PlayerReplacer
            femalePlayers={femalePlayers}
            malePlayers={malePlayers}
            onClose={() => setShowPlayerReplacer(false)}
            onSuccess={() => {
              loadPlayers();
              loadPlayerCounts();
            }}
          />
        )}



        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
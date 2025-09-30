import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar, Users, Trash2, Settings, Crown, Mail } from "lucide-react";
import { resetPlayersToPlaceholders } from "@/utils/placeholderUtils";
import { initializeTournamentDatabase } from "@/utils/tournamentInit";

interface ConfirmedPlayer {
  id: string;
  name: string;
  email: string;
  gender: string;
  registered_at: string;
}

interface TournamentSettings {
  id: string;
  tournament_date: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
}

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [confirmedPlayers, setConfirmedPlayers] = useState<ConfirmedPlayer[]>([]);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [tournamentDate, setTournamentDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      // Load confirmed players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name, email, gender, registered_at')
        .eq('is_confirmed', true)
        .order('registered_at', { ascending: true });

      if (playersError) {
        console.error('Error loading players:', playersError);
      } else {
        setConfirmedPlayers(players || []);
      }

      // Load tournament settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (settingsError) {
        console.error('Error loading settings:', settingsError);
      } else {
        setSettings(settingsData);
        setTournamentDate(settingsData?.tournament_date || '');
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTournamentDate = async () => {
    if (!tournamentDate) {
      toast({
        title: "Invalid Date",
        description: "Please select a tournament date",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from('settings')
          .update({ tournament_date: tournamentDate })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from('settings')
          .insert({
            tournament_date: tournamentDate,
            max_players_per_gender: 8,
            registration_cutoff_days: 3
          });

        if (error) throw error;
      }

      toast({
        title: "Settings Updated",
        description: "Tournament date has been updated successfully",
      });

      await loadAdminData();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update tournament date",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${playerName} from the tournament?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      toast({
        title: "Player Removed",
        description: `${playerName} has been removed from the tournament`,
      });

      await loadAdminData();
    } catch (error) {
      console.error('Error removing player:', error);
      toast({
        title: "Removal Failed",
        description: "Failed to remove player",
        variant: "destructive",
      });
    }
  };

  const handleResetToPlaceholders = async () => {
    if (!window.confirm(
      'This will reset ALL players to placeholder names ("Female Player 1", "Male Player 1", etc.) and mark them as unconfirmed. All registrations will be lost. Are you sure?'
    )) {
      return;
    }

    if (!window.confirm(
      'This action cannot be undone. All registered players will lose their registration status. Continue?'
    )) {
      return;
    }

    try {
      setIsLoading(true);
      await resetPlayersToPlaceholders();
      
      toast({
        title: "Players Reset",
        description: "All players have been reset to placeholder names. Registration can now begin fresh.",
      });
      
      await loadAdminData();
    } catch (error) {
      console.error('Error resetting players:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset players to placeholders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeDatabase = async () => {
    if (!window.confirm(
      'This will completely initialize the tournament database with fresh placeholder players. All existing data will be reset. Continue?'
    )) {
      return;
    }

    try {
      setIsLoading(true);
      await initializeTournamentDatabase();
      
      toast({
        title: "Database Initialized",
        description: "Tournament database has been set up with placeholder players and is ready for registration.",
      });
      
      await loadAdminData();
    } catch (error) {
      console.error('Error initializing database:', error);
      toast({
        title: "Initialization Failed",
        description: "Failed to initialize tournament database",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const maleCount = confirmedPlayers.filter(p => p.gender === 'male').length;
  const femaleCount = confirmedPlayers.filter(p => p.gender === 'female').length;

  if (isLoading) {
    return (
      <div className="fixed inset-4 z-50 bg-white border-2 border-purple-200 shadow-xl rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce-gentle">⚙️</div>
          <p className="text-lg font-semibold">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-white border-2 border-purple-200 shadow-xl rounded-lg overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ocean flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Admin Panel
          </h2>
          <Button
            onClick={onClose}
            variant="outline"
            className="hover:bg-coral hover:text-white"
          >
            Close
          </Button>
        </div>

        {/* Tournament Settings */}
        <Card className="border-ocean/20 bg-ocean/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ocean">
              <Calendar className="w-5 h-5" />
              Tournament Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tournamentDate">Tournament Date</Label>
              <div className="flex gap-2">
                <Input
                  id="tournamentDate"
                  type="date"
                  value={tournamentDate}
                  onChange={(e) => setTournamentDate(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleUpdateTournamentDate}
                  disabled={isSaving}
                  className="bg-ocean hover:bg-ocean-dark text-white"
                >
                  {isSaving ? 'Saving...' : 'Update'}
                </Button>
              </div>
            </div>
            {settings && (
              <div className="text-sm text-foreground/70">
                <p>Registration closes {settings.registration_cutoff_days} days before tournament</p>
                <p>Max {settings.max_players_per_gender} players per gender</p>
              </div>
            )}
            
            <div className="pt-4 border-t border-ocean/20 space-y-3">
              <Button
                onClick={handleInitializeDatabase}
                disabled={isLoading}
                className="w-full bg-palm hover:bg-palm-dark text-white"
              >
                Initialize Tournament Database
              </Button>
              <p className="text-xs text-foreground/60">
                Complete setup with placeholder players and fresh tournament settings.
              </p>
              
              <Button
                onClick={handleResetToPlaceholders}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                Reset Players Only
              </Button>
              <p className="text-xs text-foreground/60">
                Reset only players to placeholders, keeping existing matches and settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Registration Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-ocean/20 bg-ocean/10">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-ocean" />
              <h3 className="font-semibold text-ocean">Male Players</h3>
              <p className="text-2xl font-bold text-ocean">{maleCount}/8</p>
            </CardContent>
          </Card>
          
          <Card className="border-sunset/20 bg-sunset/10">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-sunset" />
              <h3 className="font-semibold text-sunset">Female Players</h3>
              <p className="text-2xl font-bold text-sunset">{femaleCount}/8</p>
            </CardContent>
          </Card>
        </div>

        {/* Confirmed Players */}
        <Card className="border-palm/20 bg-palm/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-palm">
              <Crown className="w-5 h-5" />
              Confirmed Players ({confirmedPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {confirmedPlayers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No players have registered yet.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {confirmedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-sand-dark/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{player.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          player.gender === 'male' 
                            ? 'bg-ocean/20 text-ocean' 
                            : 'bg-sunset/20 text-sunset'
                        }`}>
                          {player.gender}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-foreground/60">
                        <Mail className="w-3 h-3" />
                        {player.email}
                      </div>
                      <div className="text-xs text-foreground/50">
                        Registered: {new Date(player.registered_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemovePlayer(player.id, player.name)}
                      className="ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registration Status */}
        {(maleCount >= 8 || femaleCount >= 8) && (
          <Alert className="border-coral/30 bg-coral/10">
            <AlertDescription className="text-coral-dark">
              {maleCount >= 8 && femaleCount >= 8 
                ? "🎉 Tournament is full! Both divisions have reached maximum capacity."
                : maleCount >= 8 
                ? "Male division is full. Female division still accepting registrations."
                : "Female division is full. Male division still accepting registrations."
              }
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
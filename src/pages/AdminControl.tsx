import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Save, Crown, Users } from "lucide-react";

interface TournamentSettings {
  id?: string;
  tournament_date: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
}

export default function AdminControl() {
  const navigate = useNavigate();
  const [tournamentDate, setTournamentDate] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [registrationCutoff, setRegistrationCutoff] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingSettingsId, setExistingSettingsId] = useState<string | null>(null);
  const [playerCounts, setPlayerCounts] = useState<{ maleCount: number; femaleCount: number } | null>(null);

  useEffect(() => {
    loadTournamentSettings();
  }, []);

  const loadTournamentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setTournamentDate(data.tournament_date);
        setMaxPlayers(data.max_players_per_gender || 8);
        setRegistrationCutoff(data.registration_cutoff_days || 3);
        setExistingSettingsId(data.id);
      } else {
        // Set default values if no settings exist
        setTournamentDate(new Date().toISOString().split('T')[0]);
        setMaxPlayers(8);
        setRegistrationCutoff(3);
      }
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
      const { data: players } = await supabase
        .from('players')
        .select('gender, is_confirmed')
        .eq('is_confirmed', true);
      
      if (players) {
        const maleCount = players.filter(p => p.gender === 'male').length;
        const femaleCount = players.filter(p => p.gender === 'female').length;
        setPlayerCounts({ maleCount, femaleCount });
      }
    } catch (error) {
      console.error('Error loading player counts:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsData = {
        tournament_date: tournamentDate,
        max_players_per_gender: maxPlayers,
        registration_cutoff_days: registrationCutoff,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existingSettingsId) {
        // Update existing settings
        const result = await supabase
          .from('settings')
          .update(settingsData)
          .eq('id', existingSettingsId);
        error = result.error;
      } else {
        // Insert new settings
        const result = await supabase
          .from('settings')
          .insert(settingsData);
        error = result.error;
      }

      if (error) throw error;

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
      await supabase.auth.signOut();
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

  const handleGoToSetup = () => {
    navigate('/setup'); // Navigate to DatabaseInit page
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

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleGoToSetup}
            className="flex-1 bg-sunset hover:bg-sunset-dark text-white font-semibold py-3 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Configure Tournament
          </Button>
          <Button
            onClick={() => navigate('/tournament')}
            className="flex-1 bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            View Tournament
          </Button>
        </div>



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
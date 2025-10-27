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
  tournament_type: string;
  player_count: number;
  is_active: boolean;
}

export default function AdminControl() {
  const navigate = useNavigate();
  const [tournamentType, setTournamentType] = useState("mixed");
  const [playerCount, setPlayerCount] = useState(8);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTournamentSettings();
  }, []);

  const loadTournamentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setTournamentType(data.tournament_type);
        setPlayerCount(data.player_count);
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
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // First, deactivate any existing active settings
      await supabase
        .from('tournament_settings')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new settings
      const { error } = await supabase
        .from('tournament_settings')
        .insert({
          tournament_type: tournamentType,
          player_count: playerCount,
          is_active: true,
          created_at: new Date().toISOString(),
        });

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
          <p className="text-foreground/70">Configure and manage the tournament</p>
        </header>

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ocean">
              <Crown className="w-5 h-5" />
              Tournament Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tournamentType">Tournament Type</Label>
                <Select value={tournamentType} onValueChange={setTournamentType}>
                  <SelectTrigger className="bg-white/70 border-sand-dark/30 focus:border-ocean">
                    <SelectValue placeholder="Select tournament type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Queen of the Beach (Female Division)</SelectItem>
                    <SelectItem value="male">King of the Beach (Male Division)</SelectItem>
                    <SelectItem value="mixed">King & Queen of the Beach (Mixed Division)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="playerCount">Player Count</Label>
                <Select value={playerCount.toString()} onValueChange={(value) => setPlayerCount(Number(value))}>
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
                <p className="text-sm text-foreground/60">Tournament Type</p>
                <p className="font-semibold">
                  {tournamentType === 'female' && 'Queen of the Beach'}
                  {tournamentType === 'male' && 'King of the Beach'}
                  {tournamentType === 'mixed' && 'King & Queen of the Beach'}
                </p>
              </div>
              <div className="bg-ocean/10 p-4 rounded-lg border border-ocean/20">
                <p className="text-sm text-foreground/60">Player Count</p>
                <p className="font-semibold">{playerCount} Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
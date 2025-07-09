import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, UserMinus, X, Users, RotateCcw } from "lucide-react";
import { Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { resetAllData } from "@/utils/supabaseUtils";
import { initializeMatches } from "@/utils/matchUtils";

interface PlayerManagementProps {
  femalePlayers: Player[];
  malePlayers: Player[];
  onClose: () => void;
}

const PlayerManagement = ({ femalePlayers, malePlayers, onClose }: PlayerManagementProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [replacementName, setReplacementName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>("female");
  const [bulkFemaleNames, setBulkFemaleNames] = useState("");
  const [bulkMaleNames, setBulkMaleNames] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const allPlayers = [...femalePlayers, ...malePlayers];

  const clearAndReinitializeMatches = async () => {
    console.log('Clearing and reinitializing matches after player changes...');
    try {
      // Delete existing matches
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Wait a moment, then reinitialize matches
      await new Promise(resolve => setTimeout(resolve, 500));
      await initializeMatches();
    } catch (error) {
      console.error('Error clearing and reinitializing matches:', error);
    }
  };

  const handleReplacePlayer = async () => {
    if (!selectedPlayer || !replacementName.trim()) return;

    setIsLoading(true);
    try {
      const playerGender = femalePlayers.find(p => p.name === selectedPlayer.name) ? 'female' : 'male';
      
      const { error } = await supabase
        .from('players')
        .update({ 
          name: replacementName.trim(),
          points: 0,
          total_scores: 0 
        })
        .eq('name', selectedPlayer.name)
        .eq('gender', playerGender);

      if (error) {
        console.error('Error replacing player:', error);
        return;
      }

      // Clear and reinitialize matches when player is replaced
      await clearAndReinitializeMatches();

      setSelectedPlayer(null);
      setReplacementName("");
    } catch (error) {
      console.error('Error in handleReplacePlayer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReplace = async (gender: Gender) => {
    const names = gender === 'female' ? bulkFemaleNames : bulkMaleNames;
    if (!names.trim()) return;

    setIsLoading(true);
    try {
      const nameList = names.split('\n').map(name => name.trim()).filter(name => name);
      
      if (nameList.length !== 8) {
        alert(`Please enter exactly 8 ${gender} player names (one per line).`);
        return;
      }

      // Get existing players of this gender from database with IDs
      const { data: existingPlayers, error: fetchError } = await supabase
        .from('players')
        .select('id, name')
        .eq('gender', gender)
        .order('created_at');

      if (fetchError || !existingPlayers || existingPlayers.length !== 8) {
        console.error('Error fetching existing players:', fetchError);
        alert(`Error: Could not find exactly 8 ${gender} players to replace.`);
        return;
      }

      // Update each player with new names and reset their stats
      for (let i = 0; i < Math.min(8, nameList.length); i++) {
        const { error: updateError } = await supabase
          .from('players')
          .update({ 
            name: nameList[i],
            points: 0,
            total_scores: 0 
          })
          .eq('id', existingPlayers[i].id);

        if (updateError) {
          console.error(`Error updating player ${i}:`, updateError);
        }
      }

      // Clear and reinitialize matches after bulk replace
      await clearAndReinitializeMatches();

      // Clear the textarea
      if (gender === 'female') {
        setBulkFemaleNames("");
      } else {
        setBulkMaleNames("");
      }

      alert(`Successfully updated all ${gender} players!`);
    } catch (error) {
      console.error('Error in handleBulkReplace:', error);
      alert('Error updating players. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePlayer = async (player: Player) => {
    setIsLoading(true);
    try {
      const playerGender = femalePlayers.find(p => p.name === player.name) ? 'female' : 'male';
      
      // Actually remove the player completely
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('name', player.name)
        .eq('gender', playerGender);

      if (error) {
        console.error('Error removing player:', error);
        return;
      }

      // Clear and reinitialize matches after player removal
      await clearAndReinitializeMatches();
    } catch (error) {
      console.error('Error in handleRemovePlayer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetScoresOnly = async () => {
    if (!confirm('Reset all scores and rankings but keep current players?')) return;
    
    setIsLoading(true);
    try {
      // Reset all player points and scores to 0
      await supabase
        .from('players')
        .update({ points: 0, total_scores: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // Delete all matches
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete final match data
      await supabase.from('final_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Wait a moment, then reinitialize matches
      await new Promise(resolve => setTimeout(resolve, 500));
      await initializeMatches();
      
      alert('Scores reset successfully! Current players maintained.');
    } catch (error) {
      console.error('Error resetting scores:', error);
      alert('Error resetting scores. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetEverything = async () => {
    if (!confirm('Reset everything to default players and clear all data?')) return;
    
    setIsLoading(true);
    try {
      await resetAllData();
      alert('Everything reset to defaults successfully!');
    } catch (error) {
      console.error('Error resetting everything:', error);
      alert('Error resetting data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-h-[80vh] overflow-y-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Player Management</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bulk Replace Players */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Replace Players
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Female Players Bulk Replace */}
            <div className="space-y-3">
              <Label htmlFor="bulk-female">Female Players (8 names, one per line)</Label>
              <Textarea
                id="bulk-female"
                value={bulkFemaleNames}
                onChange={(e) => setBulkFemaleNames(e.target.value)}
                placeholder={`Enter 8 female player names:\nPlayer 1\nPlayer 2\nPlayer 3\n...`}
                rows={6}
              />
              <Button 
                onClick={() => handleBulkReplace('female')}
                disabled={isLoading || !bulkFemaleNames.trim()}
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                Replace All Female Players
              </Button>
            </div>

            {/* Male Players Bulk Replace */}
            <div className="space-y-3">
              <Label htmlFor="bulk-male">Male Players (8 names, one per line)</Label>
              <Textarea
                id="bulk-male"
                value={bulkMaleNames}
                onChange={(e) => setBulkMaleNames(e.target.value)}
                placeholder={`Enter 8 male player names:\nPlayer 1\nPlayer 2\nPlayer 3\n...`}
                rows={6}
              />
              <Button 
                onClick={() => handleBulkReplace('male')}
                disabled={isLoading || !bulkMaleNames.trim()}
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                Replace All Male Players
              </Button>
            </div>
          </div>
        </div>

        {/* Individual Replace Player */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Replace Individual Player</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="player-select">Select Player to Replace</Label>
              <Select onValueChange={(value) => {
                const player = allPlayers.find(p => p.name === value);
                setSelectedPlayer(player || null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {allPlayers.map((player) => (
                    <SelectItem key={player.name} value={player.name}>
                      {player.name} ({femalePlayers.find(p => p.name === player.name) ? 'Female' : 'Male'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedPlayer && (
              <div>
                <Label htmlFor="replacement-name">New Player Name</Label>
                <Input
                  id="replacement-name"
                  value={replacementName}
                  onChange={(e) => setReplacementName(e.target.value)}
                  placeholder="Enter new name..."
                />
              </div>
            )}
            
            <Button 
              onClick={handleReplacePlayer}
              disabled={isLoading || !selectedPlayer || !replacementName.trim()}
              className="w-full"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              Replace Player
            </Button>
          </div>
        </div>

        {/* Remove Players */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Remove Players</h3>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
            {allPlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{player.name} ({femalePlayers.find(p => p.name === player.name) ? 'Female' : 'Male'})</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleRemovePlayer(player)}
                >
                  <UserMinus className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Reset Functions */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Reset Options
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button 
              onClick={handleResetScoresOnly}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Scores Only
            </Button>
            
            <Button 
              onClick={handleResetEverything}
              disabled={isLoading}
              variant="destructive"
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Everything
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Reset Scores Only:</strong> Keeps current players, clears all scores and rankings</p>
            <p><strong>Reset Everything:</strong> Restores default player names and clears all data</p>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">
            Processing changes...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerManagement;
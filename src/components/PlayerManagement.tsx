import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserMinus, X } from "lucide-react";
import { Player, Gender } from "@/types";
import { supabase } from "@/integrations/supabase/client";

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

  const allPlayers = [...femalePlayers, ...malePlayers];

  const handleReplacePlayer = async () => {
    if (!selectedPlayer || !replacementName.trim()) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({ name: replacementName.trim() })
        .eq('name', selectedPlayer.name)
        .eq('gender', selectedPlayer.name.includes(femalePlayers.map(p => p.name).join('|')) ? 'female' : 'male');

      if (error) {
        console.error('Error replacing player:', error);
        return;
      }

      setSelectedPlayer(null);
      setReplacementName("");
    } catch (error) {
      console.error('Error in handleReplacePlayer:', error);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;

    try {
      const { error } = await supabase
        .from('players')
        .insert({
          name: newPlayerName.trim(),
          gender: newPlayerGender,
          points: 0,
          total_scores: 0
        });

      if (error) {
        console.error('Error adding player:', error);
        return;
      }

      setNewPlayerName("");
    } catch (error) {
      console.error('Error in handleAddPlayer:', error);
    }
  };

  const handleRemovePlayer = async (player: Player) => {
    try {
      const playerGender = femalePlayers.find(p => p.name === player.name) ? 'female' : 'male';
      
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('name', player.name)
        .eq('gender', playerGender);

      if (error) {
        console.error('Error removing player:', error);
        return;
      }
    } catch (error) {
      console.error('Error in handleRemovePlayer:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Player Management</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Replace Player */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Replace Player</h3>
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
              disabled={!selectedPlayer || !replacementName.trim()}
              className="w-full"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              Replace Player
            </Button>
          </div>
        </div>

        {/* Add New Player */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Add New Player</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-player-name">Player Name</Label>
              <Input
                id="new-player-name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player name..."
              />
            </div>
            
            <div>
              <Label htmlFor="new-player-gender">Gender</Label>
              <Select value={newPlayerGender} onValueChange={(value: Gender) => setNewPlayerGender(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleAddPlayer}
              disabled={!newPlayerName.trim()}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </div>
        </div>

        {/* Remove Player */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Remove Player</h3>
          <div className="grid grid-cols-1 gap-2">
            {allPlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{player.name} ({femalePlayers.find(p => p.name === player.name) ? 'Female' : 'Male'})</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemovePlayer(player)}
                >
                  <UserMinus className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerManagement;
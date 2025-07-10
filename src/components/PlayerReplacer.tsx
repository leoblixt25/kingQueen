import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { replacePlayerName } from "@/utils/simpleTournamentUtils";
import { Player, Gender } from "@/types";
import { toast } from "@/hooks/use-toast";

interface PlayerReplacerProps {
  femalePlayers: Player[];
  malePlayers: Player[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PlayerReplacer({ femalePlayers, malePlayers, onClose, onSuccess }: PlayerReplacerProps) {
  const [selectedGender, setSelectedGender] = useState<Gender>("female");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [isReplacing, setIsReplacing] = useState(false);

  const currentPlayers = selectedGender === "female" ? femalePlayers : malePlayers;

  const handleReplace = async () => {
    if (!selectedPlayer || !newName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a player and enter a new name",
        variant: "destructive",
      });
      return;
    }

    setIsReplacing(true);
    try {
      await replacePlayerName(selectedPlayer, newName.trim(), selectedGender);
      
      toast({
        title: "Player Replaced",
        description: `Successfully replaced ${selectedPlayer} with ${newName}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error replacing player:", error);
      toast({
        title: "Replace Failed",
        description: "Failed to replace player name",
        variant: "destructive",
      });
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <Card className="fixed inset-4 z-50 bg-white border-2 border-purple-200 shadow-xl">
      <CardHeader>
        <CardTitle className="text-center">Replace Player</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={selectedGender} onValueChange={(value: Gender) => {
            setSelectedGender(value);
            setSelectedPlayer("");
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Select Player to Replace</Label>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a player..." />
            </SelectTrigger>
            <SelectContent>
              {currentPlayers.map((player) => (
                <SelectItem key={player.name} value={player.name}>
                  {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>New Player Name</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new name..."
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleReplace}
            disabled={isReplacing || !selectedPlayer || !newName.trim()}
            className="flex-1"
          >
            {isReplacing ? "Replacing..." : "Replace Player"}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isReplacing}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserPlus, UserMinus, UserX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Player } from "@/types";

interface PlayerManagementProps {
  players: Player[];
  newPlayerName: string;
  setNewPlayerName: (name: string) => void;
  handleAddPlayer: () => void;
  selectedPlayer: Player | null;
  setSelectedPlayer: (player: Player | null) => void;
  replacementName: string;
  setReplacementName: (name: string) => void;
  handleReplacePlayer: () => void;
  handleRemovePlayer: (player: Player) => void;
}

export function PlayerManagement({
  players,
  newPlayerName,
  setNewPlayerName,
  handleAddPlayer,
  selectedPlayer,
  setSelectedPlayer,
  replacementName,
  setReplacementName,
  handleReplacePlayer,
  handleRemovePlayer,
}: PlayerManagementProps) {
  return (
    <Card className="mt-8 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Player Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Add New Player</h3>
          <div className="flex gap-2">
            <Input
              placeholder="New player name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
            />
            <Button onClick={handleAddPlayer}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Replace Player</h3>
          <div className="flex flex-col gap-2">
            <Select
              value={selectedPlayer?.name || ""}
              onValueChange={(value) => setSelectedPlayer(players.find(p => p.name === value) || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select player to replace" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.name} value={player.name}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="New player name"
                value={replacementName}
                onChange={(e) => setReplacementName(e.target.value)}
              />
              <Button onClick={handleReplacePlayer} disabled={!selectedPlayer || !replacementName}>
                <UserX className="w-4 h-4 mr-2" />
                Replace
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Remove Player</h3>
          <div className="space-y-2">
            {players.map((player) => (
              <div key={player.name}>
                <Button onClick={() => handleRemovePlayer(player)}>
                  <UserMinus className="w-4 h-4 mr-2" />
                  {player.name}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

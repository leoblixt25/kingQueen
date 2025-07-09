import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserMinus, X, Users, RotateCcw } from "lucide-react";
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
  const [bulkFemaleNames, setBulkFemaleNames] = useState("");
  const [bulkMaleNames, setBulkMaleNames] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const allPlayers = [...femalePlayers, ...malePlayers];

  const clearAndReinitializeMatches = async () => {
    try {
      await supabase.from("final_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      let playersReady = false;
      let attempts = 0;

      while (!playersReady && attempts < 3) {
        attempts++;
        const { data: players, error } = await supabase.from("players").select("id, gender");
        if (error) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        const femaleCount = players?.filter((p) => p.gender === "female").length || 0;
        const maleCount = players?.filter((p) => p.gender === "male").length || 0;

        if (femaleCount === 8 && maleCount === 8) {
          playersReady = true;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (playersReady) {
        await initializeMatches();
      }
    } catch (error) {
      console.error("Error during reinitialization:", error);
    }
  };

  const handleReplacePlayer = async () => {
    if (!selectedPlayer || !replacementName.trim()) return;
    setIsLoading(true);
    try {
      const gender = femalePlayers.find((p) => p.name === selectedPlayer.name) ? "female" : "male";
      await supabase
        .from("players")
        .update({ name: replacementName.trim(), points: 0, total_scores: 0 })
        .eq("name", selectedPlayer.name)
        .eq("gender", gender);

      await clearAndReinitializeMatches();
      setSelectedPlayer(null);
      setReplacementName("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReplaceBothGenders = async () => {
    setIsLoading(true);
    try {
      const replaceGender = async (gender: Gender, names: string) => {
        const nameList = names
          .split("\n")
          .map((n) => n.trim())
          .filter((n) => n);

        if (nameList.length !== 8) throw new Error(`Please enter exactly 8 ${gender} player names.`);

        const { data: existing, error } = await supabase
          .from("players")
          .select("id")
          .eq("gender", gender)
          .order("created_at");

        if (error || !existing || existing.length !== 8) throw new Error(`Couldn't fetch 8 ${gender} players.`);

        for (let i = 0; i < 8; i++) {
          await supabase
            .from("players")
            .update({ name: nameList[i], points: 0, total_scores: 0 })
            .eq("id", existing[i].id);
        }
      };

      await replaceGender("female", bulkFemaleNames);
      await replaceGender("male", bulkMaleNames);

      await clearAndReinitializeMatches();
      setBulkFemaleNames("");
      setBulkMaleNames("");
      alert("Players updated successfully.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Bulk replacement failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetScoresOnly = async () => {
    if (!confirm("Reset all scores and rankings but keep current players?")) return;
    setIsLoading(true);
    try {
      await supabase.from("players").update({ points: 0, total_scores: 0 });
      await supabase.from("matches").delete();
      await supabase.from("final_matches").delete();
      await initializeMatches();
      alert("Scores reset successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to reset scores.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetEverything = async () => {
    if (!confirm("This will clear everything and restore default players. Continue?")) return;
    setIsLoading(true);
    try {
      await resetAllData();
      alert("Data reset to defaults.");
    } catch (error) {
      console.error(error);
      alert("Failed to reset.");
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Replace All Players (Both Genders)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Female Players (8 names)</Label>
              <Textarea value={bulkFemaleNames} onChange={(e) => setBulkFemaleNames(e.target.value)} rows={6} />
            </div>
            <div className="space-y-3">
              <Label>Male Players (8 names)</Label>
              <Textarea value={bulkMaleNames} onChange={(e) => setBulkMaleNames(e.target.value)} rows={6} />
            </div>
          </div>
          <Button disabled={isLoading} onClick={handleBulkReplaceBothGenders} className="w-full">
            Replace All Players
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Replace Individual Player</h3>
          <Label>Select Player</Label>
          <Select onValueChange={(val) => setSelectedPlayer(allPlayers.find((p) => p.name === val) || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a player..." />
            </SelectTrigger>
            <SelectContent>
              {allPlayers.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name} ({femalePlayers.includes(p) ? "Female" : "Male"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="New name"
            value={replacementName}
            onChange={(e) => setReplacementName(e.target.value)}
          />
          <Button disabled={isLoading || !selectedPlayer} onClick={handleReplacePlayer} className="w-full">
            Replace Player
          </Button>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> Reset Options
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button onClick={handleResetScoresOnly} disabled={isLoading} variant="outline" className="w-full">
              Reset Scores Only
            </Button>
            <Button onClick={handleResetEverything} disabled={isLoading} variant="destructive" className="w-full">
              Reset Everything
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Reset Scores Only:</strong> Keeps current players, clears all scores and rankings.</p>
            <p><strong>Reset Everything:</strong> Clears all data and restores default players.</p>
          </div>
        </div>

        {isLoading && <div className="text-center text-muted">Processing changes...</div>}
      </CardContent>
    </Card>
  );
};

export default PlayerManagement;

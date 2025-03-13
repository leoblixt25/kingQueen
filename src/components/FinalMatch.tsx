
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash } from "lucide-react";
import { FinalMatchScores, FinalMatchWinner, Player } from "@/types";

interface FinalMatchProps {
  finalMatchScores: FinalMatchScores;
  finalMatchSubmitted: boolean;
  isEditingFinalMatch: boolean;
  isAdmin: boolean;
  malePlayers: Player[];
  femalePlayers: Player[];
  finalMatchWinner: FinalMatchWinner;
  onScoresChange: (scores: FinalMatchScores) => void;
  onSubmit: () => void;
  onEdit: () => void;
  onEditSubmit: () => void;
  onReset: () => void;
}

export function FinalMatch({
  finalMatchScores,
  finalMatchSubmitted,
  isEditingFinalMatch,
  isAdmin,
  malePlayers,
  femalePlayers,
  finalMatchWinner,
  onScoresChange,
  onSubmit,
  onEdit,
  onEditSubmit,
  onReset,
}: FinalMatchProps) {
  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Final Match</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team 1 */}
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-lg font-semibold">Team 1: {malePlayers[0].name} & {femalePlayers[1].name}</p>
            </div>
            {[0, 1, 2].map((setIndex) => (
              <div key={setIndex} className="flex flex-col space-y-2">
                <Label htmlFor={`team1-set${setIndex + 1}`}>Set {setIndex + 1}</Label>
                <Input
                  id={`team1-set${setIndex + 1}`}
                  value={finalMatchScores.team1[setIndex] !== null ? finalMatchScores.team1[setIndex] : ''}
                  onChange={(e) => {
                    const newScores = [...finalMatchScores.team1];
                    newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    onScoresChange({ ...finalMatchScores, team1: newScores as [number | null, number | null, number | null] });
                  }}
                  type="number"
                  className="w-16"
                  inputMode="numeric"
                  pattern="\d*"
                  step="any"
                  disabled={finalMatchSubmitted && !isEditingFinalMatch}
                />
              </div>
            ))}
          </div>

          {/* Team 2 */}
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-lg font-semibold">Team 2: {femalePlayers[0].name} & {malePlayers[1].name}</p>
            </div>
            {[0, 1, 2].map((setIndex) => (
              <div key={setIndex} className="flex flex-col space-y-2">
                <Label htmlFor={`team2-set${setIndex + 1}`}>Set {setIndex + 1}</Label>
                <Input
                  id={`team2-set${setIndex + 1}`}
                  value={finalMatchScores.team2[setIndex] !== null ? finalMatchScores.team2[setIndex] : ''}
                  onChange={(e) => {
                    const newScores = [...finalMatchScores.team2];
                    newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    onScoresChange({ ...finalMatchScores, team2: newScores as [number | null, number | null, number | null] });
                  }}
                  type="number"
                  className="w-16"
                  inputMode="numeric"
                  pattern="\d*"
                  step="any"
                  disabled={finalMatchSubmitted && !isEditingFinalMatch}
                />
              </div>
            ))}
          </div>

          {/* Results */}
          {!finalMatchSubmitted ? (
            <div className="flex items-center space-x-4">
              <Button onClick={onSubmit}>Submit</Button>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              <p>
                Final Match Score: Team 1 - {finalMatchScores.team1.map(s => s ?? 0).join(' - ')} | 
                Team 2 - {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
              </p>
              <Check className="text-green-500" />
              {finalMatchWinner && (
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold">Winning Team:</h2>
                    <p>{finalMatchWinner.malePlayer} is crowned King 👑.</p>
                    <p>{finalMatchWinner.femalePlayer} is crowned Queen 👑.</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold">Losing Team:</h2>
                    <p>{finalMatchWinner.losingMalePlayer} is titled Prince 🤴.</p>
                    <p>{finalMatchWinner.losingFemalePlayer} is titled Princess 👸.</p>
                  </div>
                </div>
              )}
              {isAdmin && (
                <>
                  <Button variant="outline" onClick={onEdit}>
                    <Edit className="mr-2" />
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={onReset}>
                    <Trash className="mr-2" />
                    Reset
                  </Button>
                </>
              )}
              {isEditingFinalMatch && (
                <Button onClick={onEditSubmit}>Save</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Trash } from "lucide-react";
import { FinalMatchScores, FinalMatchWinner, Player } from "@/types";

interface FinalMatchProps {
  malePlayers: Player[];
  femalePlayers: Player[];
  finalMatchScores: FinalMatchScores;
  setFinalMatchScores: (scores: FinalMatchScores) => void;
  finalMatchSubmitted: boolean;
  isEditingFinalMatch: boolean;
  finalMatchWinner: FinalMatchWinner;
  isAdmin: boolean;
  handleFinalMatchSubmit: () => void;
  handleEditFinalMatch: () => void;
  handleResetFinalMatch: () => void;
  handleFinalMatchEditSubmit: () => void;
}

export function FinalMatch({
  malePlayers,
  femalePlayers,
  finalMatchScores,
  setFinalMatchScores,
  finalMatchSubmitted,
  isEditingFinalMatch,
  finalMatchWinner,
  isAdmin,
  handleFinalMatchSubmit,
  handleEditFinalMatch,
  handleResetFinalMatch,
  handleFinalMatchEditSubmit,
}: FinalMatchProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center mb-4">
          🏆 Final Match 🏆
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Team 1 */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <h3 className="text-lg font-semibold text-center sm:min-w-[200px]">
              Team 1: {malePlayers[0]?.name} & {femalePlayers[1]?.name}
            </h3>
            <div className="flex gap-4 justify-center">
              {[0, 1, 2].map((setIndex) => (
                <div key={setIndex} className="space-y-2">
                  <Label htmlFor={`team1-set${setIndex + 1}`} className="text-center block">Set {setIndex + 1}</Label>
                  <Input
                    id={`team1-set${setIndex + 1}`}
                    value={finalMatchScores.team1[setIndex] !== null ? finalMatchScores.team1[setIndex] : ''}
                    onChange={(e) => {
                      const newScores = [...finalMatchScores.team1];
                      newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      setFinalMatchScores({
                        ...finalMatchScores,
                        team1: newScores as [number | null, number | null, number | null]
                      });
                    }}
                    type="number"
                    className="w-16 text-center"
                    inputMode="numeric"
                    pattern="\d*"
                    disabled={finalMatchSubmitted && !isEditingFinalMatch}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team 2 */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <h3 className="text-lg font-semibold text-center sm:min-w-[200px]">
              Team 2: {femalePlayers[0]?.name} & {malePlayers[1]?.name}
            </h3>
            <div className="flex gap-4 justify-center">
              {[0, 1, 2].map((setIndex) => (
                <div key={setIndex} className="space-y-2">
                  <Label htmlFor={`team2-set${setIndex + 1}`} className="text-center block">Set {setIndex + 1}</Label>
                  <Input
                    id={`team2-set${setIndex + 1}`}
                    value={finalMatchScores.team2[setIndex] !== null ? finalMatchScores.team2[setIndex] : ''}
                    onChange={(e) => {
                      const newScores = [...finalMatchScores.team2];
                      newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      setFinalMatchScores({
                        ...finalMatchScores,
                        team2: newScores as [number | null, number | null, number | null]
                      });
                    }}
                    type="number"
                    className="w-16 text-center"
                    inputMode="numeric"
                    pattern="\d*"
                    disabled={finalMatchSubmitted && !isEditingFinalMatch}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {!finalMatchSubmitted ? (
          <div className="flex justify-center pt-4">
            <Button onClick={handleFinalMatchSubmit} className="w-full sm:w-auto">
              Submit Final Match
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-center">Final Match Results</h3>
              <div className="space-y-2 text-center">
                <p className="text-gray-600">
                  Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                </p>
                <p className="text-gray-600">
                  Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                </p>
              </div>
            </div>

            {finalMatchWinner && (
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-lg">
                <div className="space-y-4 text-center">
                  <div>
                    <h3 className="text-xl font-bold mb-2">👑 Champions 👑</h3>
                    <p className="text-lg">
                      King {finalMatchWinner.malePlayer} & Queen {finalMatchWinner.femalePlayer}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Runners-up</h3>
                    <p>
                      Prince {finalMatchWinner.losingMalePlayer} & Princess {finalMatchWinner.losingFemalePlayer}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="flex flex-col sm:flex-row justify-center gap-2">
                <Button variant="outline" onClick={handleEditFinalMatch}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Match
                </Button>
                <Button variant="destructive" onClick={handleResetFinalMatch}>
                  <Trash className="w-4 h-4 mr-2" />
                  Reset Match
                </Button>
                {isEditingFinalMatch && (
                  <Button onClick={handleFinalMatchEditSubmit}>
                    Save Changes
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

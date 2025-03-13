
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Player } from "@/types";

interface RankingsProps {
  players: Player[];
}

export function Rankings({ players }: RankingsProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Rankings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-right py-2 px-2">Pts</th>
                <th className="text-right py-2 px-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.name} className="border-b last:border-0">
                  <td className="py-2 px-2">{index + 1}</td>
                  <td className="py-2 px-2">{player.name}</td>
                  <td className="py-2 px-2 text-right">{player.points}</td>
                  <td className="py-2 px-2 text-right">{player.totalScores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Player } from "@/types";

interface RankingsTableProps {
  players: Player[];
  title: string;
}

export function RankingsTable({ players, title }: RankingsTableProps) {
  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border-b">Rank</th>
                <th className="p-2 border-b">Player Name</th>
                <th className="p-2 border-b">Points</th>
                <th className="p-2 border-b">Total Scores</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.name}>
                  <td className="p-2 border-b text-center">{index + 1}</td>
                  <td className="p-2 border-b">{player.name}</td>
                  <td className="p-2 border-b text-center">{player.points}</td>
                  <td className="p-2 border-b text-center">{player.totalScores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}

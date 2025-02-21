
import { Player } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy } from "lucide-react";

interface RankingsTableProps {
  players: Player[];
}

const RankingsTable = ({ players }: RankingsTableProps) => {
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.totalScore - a.totalScore;
  });

  return (
    <div className="rounded-lg border shadow-sm animate-slide-up">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">Total Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPlayers.map((player, index) => (
            <TableRow key={player.name}>
              <TableCell className="font-medium">
                <div className="flex items-center">
                  {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 mr-1" />}
                  {index + 1}
                </div>
              </TableCell>
              <TableCell>{player.name}</TableCell>
              <TableCell className="text-right">{player.points}</TableCell>
              <TableCell className="text-right">{player.totalScore}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RankingsTable;

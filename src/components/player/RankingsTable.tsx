import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Medal, Trophy } from 'lucide-react';
import { RankingEntry, Gender } from '@/types';

interface RankingsTableProps {
  rankings: RankingEntry[];
  gender: Gender;
  title?: string;
}

export function RankingsTable({ rankings, gender, title }: RankingsTableProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Trophy className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">#{rank}</Badge>;
      case 2:
        return <Badge className="bg-gray-400 hover:bg-gray-500">#{rank}</Badge>;
      case 3:
        return <Badge className="bg-amber-600 hover:bg-amber-700">#{rank}</Badge>;
      default:
        return <Badge variant="outline">#{rank}</Badge>;
    }
  };

  const genderColor = gender === 'male' ? 'blue' : 'pink';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full bg-${genderColor}-500`} />
          {title || `${gender.charAt(0).toUpperCase() + gender.slice(1)} Rankings`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rankings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No rankings available yet
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((entry) => (
              <div
                key={entry.player.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  entry.rank <= 3 ? 'bg-gradient-to-r from-gray-50 to-white border-gray-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {getRankIcon(entry.rank)}
                    {getRankBadge(entry.rank)}
                  </div>
                  <div>
                    <div className="font-semibold">{entry.player.name}</div>
                    <div className="text-sm text-gray-500">
                      {entry.matches_played} match{entry.matches_played !== 1 ? 'es' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{entry.points} pts</div>
                  <div className="text-sm text-gray-500">{entry.total_scores} total</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
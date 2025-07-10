import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Crown, Trophy, Medal, Star } from 'lucide-react';
import { FinalMatch as FinalMatchType } from '@/types';

interface FinalMatchProps {
  finalMatch: FinalMatchType | null;
  onGenerateFinal: () => Promise<any>;
  onScoreUpdate?: (score1: number, score2: number) => Promise<any>;
  isAdmin?: boolean;
}

export function FinalMatch({ finalMatch, onGenerateFinal, onScoreUpdate, isAdmin = false }: FinalMatchProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [score1, setScore1] = useState(finalMatch?.team1_score.toString() || '0');
  const [score2, setScore2] = useState(finalMatch?.team2_score.toString() || '0');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await onGenerateFinal();
      if (!result.success) {
        alert('Failed to generate final match');
      }
    } catch (error) {
      console.error('Error generating final match:', error);
      alert('Failed to generate final match');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveScore = async () => {
    if (!onScoreUpdate) return;
    
    const numScore1 = parseInt(score1, 10);
    const numScore2 = parseInt(score2, 10);

    if (isNaN(numScore1) || isNaN(numScore2)) {
      alert('Please enter valid scores');
      return;
    }

    try {
      const result = await onScoreUpdate(numScore1, numScore2);
      if (result.success) {
        setIsEditing(false);
      } else {
        alert('Failed to update score');
      }
    } catch (error) {
      console.error('Error updating final score:', error);
      alert('Failed to update final score');
    }
  };

  if (!finalMatch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Championship Final
            <Crown className="w-6 h-6 text-yellow-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="py-8">
            <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-6">
              Complete all matches to generate the championship final
            </p>
            {isAdmin && (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                <Crown className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Final Match'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getWinnerTeam = () => {
    if (!finalMatch.is_completed) return null;
    return finalMatch.team1_score > finalMatch.team2_score ? 1 : 2;
  };

  const winnerTeam = getWinnerTeam();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Crown className="w-6 h-6 text-yellow-500" />
          Championship Final
          <Crown className="w-6 h-6 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team 1: King + Princess */}
        <div className={`p-4 rounded-lg border-2 ${
          winnerTeam === 1 ? 'border-yellow-400 bg-yellow-50' : 'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600">Team 1</Badge>
                {winnerTeam === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-600" />
                  <span className="font-semibold">{finalMatch.male_king?.name}</span>
                  <Badge variant="outline" className="text-xs">King</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-pink-500" />
                  <span className="font-semibold">{finalMatch.female_princess?.name}</span>
                  <Badge variant="outline" className="text-xs">Princess</Badge>
                </div>
              </div>
            </div>
            <div className="ml-4">
              {isEditing ? (
                <Input
                  type="number"
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  className="w-16 text-center"
                  min="0"
                />
              ) : (
                <div className="w-16 text-center font-bold text-2xl text-blue-800">
                  {finalMatch.team1_score}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="text-center font-bold text-xl text-gray-500">VS</div>

        {/* Team 2: Queen + Prince */}
        <div className={`p-4 rounded-lg border-2 ${
          winnerTeam === 2 ? 'border-yellow-400 bg-yellow-50' : 'border-purple-200 bg-purple-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-purple-600">Team 2</Badge>
                {winnerTeam === 2 && <Crown className="w-4 h-4 text-yellow-500" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold">{finalMatch.female_queen?.name}</span>
                  <Badge variant="outline" className="text-xs">Queen</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">{finalMatch.male_prince?.name}</span>
                  <Badge variant="outline" className="text-xs">Prince</Badge>
                </div>
              </div>
            </div>
            <div className="ml-4">
              {isEditing ? (
                <Input
                  type="number"
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  className="w-16 text-center"
                  min="0"
                />
              ) : (
                <div className="w-16 text-center font-bold text-2xl text-purple-800">
                  {finalMatch.team2_score}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Winner Display */}
        {finalMatch.is_completed && winnerTeam && (
          <div className="text-center p-4 bg-yellow-100 rounded-lg border border-yellow-300">
            <Trophy className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
            <div className="font-bold text-lg text-yellow-800">
              🏆 Team {winnerTeam} Wins! 🏆
            </div>
          </div>
        )}

        {/* Controls */}
        {isAdmin && (
          <div className="space-y-2">
            {isEditing ? (
              <div className="flex gap-2">
                <Button onClick={handleSaveScore} className="flex-1">
                  Save Score
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="w-full"
              >
                Edit Final Score
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
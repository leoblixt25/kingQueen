import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, X, Check } from 'lucide-react';
import { Match } from '@/types';
import { validateScore } from '@/utils/calculations';

interface MatchCardProps {
  match: Match;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => Promise<any>;
  isAdmin?: boolean;
}

export function MatchCard({ match, onScoreUpdate, isAdmin = false }: MatchCardProps) {
  const [isEditing, setIsEditing] = useState(!match.is_completed);
  const [score1, setScore1] = useState(match.score1.toString());
  const [score2, setScore2] = useState(match.score2.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const numScore1 = parseInt(score1, 10);
    const numScore2 = parseInt(score2, 10);

    if (!validateScore(numScore1) || !validateScore(numScore2)) {
      alert('Please enter valid scores (0-999)');
      return;
    }

    setIsSaving(true);
    try {
      const result = await onScoreUpdate(match.id, numScore1, numScore2);
      if (result.success) {
        setIsEditing(false);
      } else {
        alert('Failed to update score');
      }
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setScore1(match.score1.toString());
    setScore2(match.score2.toString());
    setIsEditing(false);
  };

  const handleEdit = () => {
    setScore1(match.score1.toString());
    setScore2(match.score2.toString());
    setIsEditing(true);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            Match {match.match_number}
          </CardTitle>
          <div className="flex gap-2">
            {match.is_completed && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
            {isAdmin && match.is_completed && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="h-7 px-2"
              >
                <Edit className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Team 1 */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex-1">
            <div className="font-semibold text-blue-800">
              {match.player1?.name} & {match.player2?.name}
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
                max="999"
              />
            ) : (
              <div className="w-16 text-center font-bold text-xl text-blue-800">
                {match.score1}
              </div>
            )}
          </div>
        </div>

        {/* VS */}
        <div className="text-center font-bold text-gray-500">VS</div>

        {/* Team 2 */}
        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
          <div className="flex-1">
            <div className="font-semibold text-purple-800">
              {match.player3?.name} & {match.player4?.name}
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
                max="999"
              />
            ) : (
              <div className="w-16 text-center font-bold text-xl text-purple-800">
                {match.score2}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Score'}
            </Button>
            {match.is_completed && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
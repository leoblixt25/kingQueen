import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MatchCard } from '@/components/match/MatchCard';
import { RankingsTable } from '@/components/player/RankingsTable';
import { ResetControls } from '@/components/tournament/ResetControls';
import { FinalMatch } from '@/components/final/FinalMatch';
import { useTournament } from '@/hooks/useTournament';
import { 
  Users, 
  Trophy, 
  Crown, 
  Settings, 
  Play,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function TournamentPage() {
  const [activeTab, setActiveTab] = useState('male');
  const [showAdmin, setShowAdmin] = useState(false);
  const {
    players,
    matches,
    rankings,
    finalMatch,
    currentPhase,
    isLoading,
    error,
    actions
  } = useTournament();

  const stats = {
    totalPlayers: players.male.length + players.female.length,
    totalMatches: matches.male.length + matches.female.length,
    completedMatches: matches.male.filter(m => m.is_completed).length + 
                     matches.female.filter(m => m.is_completed).length,
  };

  const getPhaseInfo = () => {
    switch (currentPhase) {
      case 'setup':
        return { 
          icon: <Settings className="w-4 h-4" />, 
          label: 'Setup', 
          color: 'bg-gray-500' 
        };
      case 'active':
        return { 
          icon: <Play className="w-4 h-4" />, 
          label: 'In Progress', 
          color: 'bg-blue-500' 
        };
      case 'final':
        return { 
          icon: <Crown className="w-4 h-4" />, 
          label: 'Final Ready', 
          color: 'bg-yellow-500' 
        };
      case 'completed':
        return { 
          icon: <CheckCircle className="w-4 h-4" />, 
          label: 'Completed', 
          color: 'bg-green-500' 
        };
      default:
        return { 
          icon: <Clock className="w-4 h-4" />, 
          label: 'Unknown', 
          color: 'bg-gray-400' 
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <div className="text-lg font-semibold">Loading Tournament...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error}</p>
            <Button onClick={actions.refresh} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initialize tournament if no data
  if (stats.totalPlayers === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">King & Queen Of The Beach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
            <p>Welcome! Initialize the tournament to get started.</p>
            <Button 
              onClick={actions.initialize} 
              size="lg" 
              className="w-full"
            >
              Initialize Tournament
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                King & Queen Of The Beach
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <Badge className={`${phaseInfo.color} text-white`}>
                  {phaseInfo.icon}
                  <span className="ml-1">{phaseInfo.label}</span>
                </Badge>
                <div className="text-sm text-gray-600">
                  {stats.completedMatches}/{stats.totalMatches} matches completed
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowAdmin(!showAdmin)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Admin
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Final Match */}
            {(currentPhase === 'final' || currentPhase === 'completed') && (
              <FinalMatch
                finalMatch={finalMatch}
                onGenerateFinal={actions.generateFinalMatch}
                isAdmin={showAdmin}
              />
            )}

            {/* Tournament Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="male" className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Male Division
                </TabsTrigger>
                <TabsTrigger value="female" className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-500" />
                  Female Division
                </TabsTrigger>
              </TabsList>

              {/* Male Division */}
              <TabsContent value="male" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.male.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onScoreUpdate={actions.updateMatchScore}
                      isAdmin={showAdmin}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* Female Division */}
              <TabsContent value="female" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.female.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onScoreUpdate={actions.updateMatchScore}
                      isAdmin={showAdmin}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tournament Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Tournament Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span className="font-semibold">{stats.totalPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matches:</span>
                  <span className="font-semibold">{stats.totalMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="font-semibold">{stats.completedMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span className="font-semibold">
                    {Math.round((stats.completedMatches / stats.totalMatches) * 100)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Rankings */}
            <RankingsTable
              rankings={rankings[activeTab as keyof typeof rankings]}
              gender={activeTab as 'male' | 'female'}
            />

            {/* Admin Controls */}
            {showAdmin && (
              <ResetControls
                onResetScores={actions.resetScores}
                onRefresh={actions.refresh}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ArrowLeft, Trophy, Check } from "lucide-react";
import { db } from "@/config/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Player } from "@/types";

// Rankings Tab Component
function RankingsTab({ activeTab, currentPlayers }: { activeTab: string; currentPlayers: Player[] }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-center bg-beach-gradient bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6" />
          {activeTab === 'female' ? 'Female' : 'Male'} Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentPlayers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-lg text-foreground/60">
              No players registered yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentPlayers.map((player, index) => (
              <div
                key={`${player.id || player.name}-${index}`}
                className={`flex items-center justify-between p-4 rounded-xl shadow-sand transition-all duration-300 ${
                  index === 0
                    ? 'bg-sunset-gradient text-white'
                    : index === 1
                    ? 'bg-ocean/20 border-2 border-ocean/30'
                    : index === 2
                    ? 'bg-palm/20 border-2 border-palm/30'
                    : 'bg-sand-light/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xl font-bold ${
                      index === 0
                        ? 'text-white'
                        : index === 1
                        ? 'text-ocean'
                        : index === 2
                        ? 'text-palm'
                        : 'text-foreground'
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <span
                    className={`font-bold text-lg ${
                      index === 0 ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {player.name}
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-bold ${
                      index === 0 ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {player.points} pts
                  </div>
                  <div
                    className={`text-sm ${
                      index === 0 ? 'text-white/80' : 'text-foreground/60'
                    }`}
                  >
                    {player.totalScores} total
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Final Match Tab Component
function FinalMatchTab({ finalMatchData, femalePlayers, malePlayers }: { 
  finalMatchData: any; 
  femalePlayers: Player[]; 
  malePlayers: Player[];
}) {
  console.log('🏆 [FINAL TAB] Rendering with data:', finalMatchData);
  console.log('🏆 [FINAL TAB] Female players:', femalePlayers.length);
  console.log('🏆 [FINAL TAB] Male players:', malePlayers.length);
  
  // Check if final match has been submitted - use actual Firebase field names
  const isSubmitted = finalMatchData?.is_completed || false;
  
  // Extract scores using actual Firebase field names: team1_set1, team1_set2, team1_set3
  const team1Scores = [
    finalMatchData?.team1_set1 ?? null,
    finalMatchData?.team1_set2 ?? null,
    finalMatchData?.team1_set3 ?? null
  ];
  
  const team2Scores = [
    finalMatchData?.team2_set1 ?? null,
    finalMatchData?.team2_set2 ?? null,
    finalMatchData?.team2_set3 ?? null
  ];
  
  console.log('🏆 [FINAL TAB] isSubmitted:', isSubmitted);
  console.log('🏆 [FINAL TAB] Team 1 scores:', team1Scores);
  console.log('🏆 [FINAL TAB] Team 2 scores:', team2Scores);
  
  // Determine winner based on sets won
  let team1Sets = 0;
  let team2Sets = 0;
  
  if (isSubmitted) {
    for (let i = 0; i < 3; i++) {
      const s1 = team1Scores[i] ?? 0;
      const s2 = team2Scores[i] ?? 0;
      if (s1 > s2) team1Sets++;
      else if (s2 > s1) team2Sets++;
    }
  }
  
  const winningTeam = finalMatchData?.winner_team || (team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : null);
  
  console.log('🏆 [FINAL TAB] Team 1 sets:', team1Sets, 'Team 2 sets:', team2Sets, 'Winner:', winningTeam);
  
  if (!isSubmitted) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center bg-beach-gradient bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Crown className="w-6 h-6" />
            Championship Final
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <div className="text-6xl">🏐</div>
            <p className="text-lg text-foreground/60 font-medium">
              Final match not played yet
            </p>
            <p className="text-sm text-foreground/50">
              The championship final will be displayed here once completed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Match Header */}
      <Card className="bg-beach-gradient text-white shadow-beach">
        <CardContent className="p-6 text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">
            <Crown className="w-6 h-6" />
            Championship Final
            <Crown className="w-6 h-6" />
          </h2>
          <div className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span className="font-semibold">Match Complete</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Teams and Scores */}
      <div className="grid grid-cols-1 gap-4">
        {/* Team 1 */}
        <Card className={`border-2 ${winningTeam === 1 ? 'border-palm/50 bg-palm-light/20' : 'border-ocean/20 bg-white/80'} backdrop-blur-sm shadow-beach`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-lg font-bold text-ocean">
              🏐 Team 1 {winningTeam === 1 && '👑'}
            </CardTitle>
            <div className="text-center">
              <p className="text-xl text-ocean-dark font-semibold">
                {malePlayers[0]?.name || 'TBD'} & {femalePlayers[1]?.name || 'TBD'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-4">
              {team1Scores.map((score: number | null, index: number) => (
                <div key={index} className="text-center">
                  <p className="text-xs text-foreground/60 mb-1">Set {index + 1}</p>
                  <p className="text-2xl font-bold text-ocean">
                    {score ?? '-'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="bg-sunset-gradient text-white px-8 py-3 rounded-full font-bold text-xl shadow-beach">
            ⚡ VS ⚡
          </div>
        </div>

        {/* Team 2 */}
        <Card className={`border-2 ${winningTeam === 2 ? 'border-palm/50 bg-palm-light/20' : 'border-sunset/20 bg-white/80'} backdrop-blur-sm shadow-beach`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-lg font-bold text-sunset">
              🏐 Team 2 {winningTeam === 2 && '👑'}
            </CardTitle>
            <div className="text-center">
              <p className="text-xl text-sunset-dark font-semibold">
                {femalePlayers[0]?.name || 'TBD'} & {malePlayers[1]?.name || 'TBD'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-4">
              {team2Scores.map((score: number | null, index: number) => (
                <div key={index} className="text-center">
                  <p className="text-xs text-foreground/60 mb-1">Set {index + 1}</p>
                  <p className="text-2xl font-bold text-sunset">
                    {score ?? '-'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Winner Display */}
      {winningTeam && (
        <Card className="border-2 border-sunset/30 bg-sunset-gradient shadow-beach">
          <CardContent className="p-6">
            <div className="text-center space-y-6">
              {/* Champions Section - Main Highlight */}
              <div className="bg-white/20 backdrop-blur-sm text-white rounded-3xl p-6 space-y-4">
                <h3 className="text-3xl font-extrabold flex items-center justify-center gap-3 mb-4">
                  <Crown className="w-10 h-10" />
                  🏆 Champions 🏆
                  <Crown className="w-10 h-10" />
                </h3>
                <div className="space-y-4">
                  {winningTeam === 1 ? (
                    <>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-lg font-bold mb-1 opacity-90">👑 King</p>
                        <p className="text-2xl font-extrabold">{malePlayers[0]?.name || 'Unknown'}</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-lg font-bold mb-1 opacity-90">👑 Queen</p>
                        <p className="text-2xl font-extrabold">{femalePlayers[1]?.name || 'Unknown'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-lg font-bold mb-1 opacity-90">👑 King</p>
                        <p className="text-2xl font-extrabold">{malePlayers[1]?.name || 'Unknown'}</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-lg font-bold mb-1 opacity-90">👑 Queen</p>
                        <p className="text-2xl font-extrabold">{femalePlayers[0]?.name || 'Unknown'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Runners-up Section - Secondary */}
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 space-y-3">
                <h3 className="text-xl font-bold text-white mb-3">🥈 Runners-up</h3>
                <div className="space-y-3">
                  {winningTeam === 1 ? (
                    <>
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-base font-bold text-white/80 mb-1">🤴 Prince</p>
                        <p className="text-lg font-bold text-white">{malePlayers[1]?.name || 'Unknown'}</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-base font-bold text-white/80 mb-1">👸 Princess</p>
                        <p className="text-lg font-bold text-white">{femalePlayers[0]?.name || 'Unknown'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-base font-bold text-white/80 mb-1">🤴 Prince</p>
                        <p className="text-lg font-bold text-white">{malePlayers[0]?.name || 'Unknown'}</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-base font-bold text-white/80 mb-1">👸 Princess</p>
                        <p className="text-lg font-bold text-white">{femalePlayers[1]?.name || 'Unknown'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LiveRanking() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'female' | 'male' | 'final'>('female');
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [finalMatchData, setFinalMatchData] = useState<any>(null);

  useEffect(() => {
    console.log('🏆 [LIVE RANKING] Setting up real-time listeners...');
    
    // Set up real-time listener for players collection
    const playersRef = collection(db, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      console.log('🔁 [LIVE RANKING] Players data updated:', snapshot.docs.length, 'players');
      
      const allPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        points: doc.data().points || 0,
        totalScores: doc.data().total_scores || 0,
        gender: doc.data().gender
      }));

      // Separate and sort players
      const females = allPlayers
        .filter(p => p.gender === 'female')
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.totalScores - a.totalScores;
        });

      const males = allPlayers
        .filter(p => p.gender === 'male')
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.totalScores - a.totalScores;
        });

      setFemalePlayers(females);
      setMalePlayers(males);
      setIsLoading(false);
      
      console.log('✅ [LIVE RANKING] Updated - Female:', females.length, 'Male:', males.length);
    }, (error) => {
      console.error('❌ [LIVE RANKING] Error loading players:', error);
      setIsLoading(false);
    });

    // Set up real-time listener for final match
    const finalMatchRef = collection(db, 'finalMatches');
    const unsubscribeFinal = onSnapshot(finalMatchRef, (snapshot) => {
      console.log('🔁 [LIVE RANKING] Final match data updated');
      
      if (snapshot.empty) {
        console.log('ℹ️ [LIVE RANKING] No final match yet');
        setFinalMatchData(null);
      } else {
        const firstDoc = snapshot.docs[0];
        const data = { id: firstDoc.id, ...firstDoc.data() };
        console.log('✅ [LIVE RANKING] Final match loaded:', data);
        setFinalMatchData(data);
      }
    }, (error) => {
      console.error('❌ [LIVE RANKING] Error loading final match:', error);
    });

    // Cleanup listeners on unmount
    return () => {
      console.log('🧹 [LIVE RANKING] Cleaning up listeners...');
      unsubscribePlayers();
      unsubscribeFinal();
    };
  }, []);

  const currentPlayers = activeTab === 'female' ? femalePlayers : malePlayers;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏆</div>
          <h2 className="text-2xl font-bold mb-3 bg-beach-gradient bg-clip-text text-transparent">
            Loading Rankings...
          </h2>
          <p className="text-foreground/70 font-medium">Fetching live tournament data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <header className="text-center space-y-4">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="pt-4">
            <div className="text-5xl mb-3 animate-bounce-gentle">🏆</div>
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-beach-gradient bg-clip-text drop-shadow-sm">
              Live Ranking
            </h1>
            <div className="w-16 h-1 bg-sunset mx-auto rounded-full mt-3"></div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('female')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              activeTab === 'female'
                ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
            }`}
          >
            👩 Female
          </Button>
          <Button
            onClick={() => setActiveTab('male')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              activeTab === 'male'
                ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
            }`}
          >
            👨 Male
          </Button>
          <Button
            onClick={() => setActiveTab('final')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              activeTab === 'final'
                ? 'bg-beach-gradient hover:opacity-90 text-white shadow-beach'
                : 'bg-white/70 hover:bg-beach-gradient hover:text-white border-primary/30 text-primary shadow-sand'
            }`}
          >
            👑 Final
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'final' ? (
          <FinalMatchTab 
            finalMatchData={finalMatchData}
            femalePlayers={femalePlayers}
            malePlayers={malePlayers}
          />
        ) : (
          <RankingsTab 
            activeTab={activeTab}
            currentPlayers={currentPlayers}
          />
        )}

        {/* Footer Info */}
        <div className="text-center text-xs text-foreground/60">
          <p>Rankings update automatically in real-time</p>
          <p className="mt-1">Win = 2 pts • Loss = 1 pt • Tiebreaker: Total scores</p>
        </div>
      </div>
    </div>
  );
}

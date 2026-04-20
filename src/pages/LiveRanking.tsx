import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ArrowLeft, Trophy } from "lucide-react";
import { db } from "@/config/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Player } from "@/types";

export default function LiveRanking() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'female' | 'male'>('female');
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🏆 [LIVE RANKING] Setting up real-time listener...');
    
    // Set up real-time listener for players collection
    const playersRef = collection(db, 'players');
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
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

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 [LIVE RANKING] Cleaning up listener...');
      unsubscribe();
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
        <div className="flex gap-3">
          <Button
            onClick={() => setActiveTab('female')}
            className={`flex-1 touch-target font-semibold text-lg py-4 transition-all duration-300 ${
              activeTab === 'female'
                ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
            }`}
          >
            👩 Female
          </Button>
          <Button
            onClick={() => setActiveTab('male')}
            className={`flex-1 touch-target font-semibold text-lg py-4 transition-all duration-300 ${
              activeTab === 'male'
                ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
            }`}
          >
            👨 Male
          </Button>
        </div>

        {/* Rankings List */}
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

        {/* Footer Info */}
        <div className="text-center text-xs text-foreground/60">
          <p>Rankings update automatically in real-time</p>
          <p className="mt-1">Win = 2 pts • Loss = 1 pt • Tiebreaker: Total scores</p>
        </div>
      </div>
    </div>
  );
}

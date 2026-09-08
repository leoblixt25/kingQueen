import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Users, Info, Trophy, Shuffle, Download } from "lucide-react";
import { auth, db } from "@/config/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import MainTitle from "@/components/MainTitle";

export default function Landing() {
  const navigate = useNavigate();
  const [isAdminRegistered, setIsAdminRegistered] = useState(false);
  const [finishedMatches, setFinishedMatches] = useState(0);

  useEffect(() => {
    checkAdminStatus();
    
    const matchesRef = collection(db, 'matches');
    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      const allMatches = snapshot.docs.map(doc => doc.data());
      const finished = allMatches.filter(match => 
        match.is_completed || (match.score1 !== undefined && match.score2 !== undefined && match.score1 > 0 && match.score2 > 0)
      ).length;
      setFinishedMatches(finished);
    });
    
    return () => unsubscribeMatches();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const user = auth.currentUser;
      // In a real app, you would check if the user has admin role
      // For now, we'll just check if user is authenticated
      setIsAdminRegistered(!!user);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const handleAdminClick = () => {
    navigate('/admin/login');
  };

  const handlePlayerClick = () => {
    navigate('/player-access');
  };

  const handleInfoClick = () => {
    navigate('/info');
  };

  const handleLiveRankingClick = () => {
    navigate('/live-ranking');
  };

  const handleInstallClick = () => {
    navigate('/install');
  };

  const handleDrawClick = () => {
    navigate('/draw-live');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-24 pb-8 flex items-start justify-center">
      <div className="w-full max-w-md mx-auto text-center animate-fade-in">
        <div className="mb-4 animate-bounce-gentle">
          <div className="text-6xl md:text-7xl">🏐</div>
        </div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-6">
          <MainTitle />
        </div>
        
        <div className="space-y-4">
          <Button
            onClick={handleAdminClick}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-sunset to-coral hover:from-sunset-dark hover:to-coral text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Crown className="w-6 h-6" />
            Admin
          </Button>
          <Button
            onClick={handlePlayerClick}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-ocean to-ocean-light hover:from-ocean-dark hover:to-ocean text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Users className="w-6 h-6" />
            Player
          </Button>
          <Button
            onClick={handleInfoClick}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-palm to-palm-light hover:from-palm-dark hover:to-palm text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Info className="w-6 h-6" />
            Info
          </Button>
          <Button
            onClick={handleDrawClick}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Shuffle className="w-6 h-6" />
            Tournament Draw
          </Button>
          <Button
            onClick={handleLiveRankingClick}
            className="w-full py-7 text-xl font-bold bg-beach-gradient hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Trophy className="w-6 h-6" />
            <span>Live Ranking</span>
            <span className={`w-3 h-3 rounded-full border-2 border-white ${finishedMatches === 28 ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.9)]'}`} />
          </Button>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleInstallClick}
            variant="outline"
            size="sm"
            className="text-foreground/70 hover:text-ocean hover:border-ocean/40"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Install App
          </Button>
        </div>
        
        <div className="mt-10 text-sm text-foreground/60 text-center">
          <p>Designed and created by <span className="font-bold text-foreground/80">Leo Blixt</span> with a love for beach volleyball</p>
        </div>
      </div>
    </div>
  );
}
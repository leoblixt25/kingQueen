import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Users, Info, Trophy } from "lucide-react";
import { auth } from "@/config/firebase";

export default function Landing() {
  const navigate = useNavigate();
  const [isAdminRegistered, setIsAdminRegistered] = useState(false);
  const [ballFrame, setBallFrame] = useState(0);

  useEffect(() => {
    checkAdminStatus();
    
    // Ball spinning animation
    const ballInterval = setInterval(() => {
      setBallFrame((prev) => (prev + 1) % 3);
    }, 200);
    
    return () => clearInterval(ballInterval);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto text-center animate-fade-in">
        <div className="mb-8 animate-bounce-gentle">
          <img 
            src={`/ball${ballFrame + 1}.jpg`} 
            alt="Volleyball" 
            className="w-24 h-24 md:w-32 md:h-32 mx-auto object-cover rounded-full shadow-2xl transition-opacity duration-100"
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-gradient-to-r from-ocean via-sunset to-coral bg-clip-text mb-10 drop-shadow-sm tracking-wide">
          King & Queen of the Beach
        </h1>
        

        
        <div className="space-y-5">
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
            onClick={handleLiveRankingClick}
            className="w-full py-7 text-xl font-bold bg-beach-gradient hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Trophy className="w-6 h-6" />
            Live Ranking
          </Button>
        </div>
        
        <div className="mt-8 text-xs text-foreground/60 text-center">
          <p>Designed and created by <span className="font-bold text-foreground/80">Leo Blixt</span> with a love for beach volleyball</p>
        </div>
      </div>
    </div>
  );
}
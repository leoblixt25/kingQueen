import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Users, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export default function Landing() {
  const navigate = useNavigate();
  const [isAdminRegistered, setIsAdminRegistered] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="text-6xl mb-6 animate-bounce-gentle">🏐</div>
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-8 drop-shadow-sm">
          King & Queen of the Beach
        </h1>
        

        
        <div className="space-y-6">
          <Button
            onClick={handleAdminClick}
            className="w-full py-6 text-xl font-bold bg-sunset hover:bg-sunset-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
          >
            <Crown className="w-6 h-6" />
            Admin
          </Button>
          <Button
            onClick={handlePlayerClick}
            className="w-full py-6 text-xl font-bold bg-ocean hover:bg-ocean-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
          >
            <Users className="w-6 h-6" />
            Player
          </Button>
        </div>
        
        <div className="mt-8 text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
          <p className="mt-2 text-xs">
            {isAdminRegistered 
              ? "As an authenticated user, you can access both admin and player features." 
              : "First-time users should register as a player."}
          </p>
        </div>
      </div>
    </div>
  );
}
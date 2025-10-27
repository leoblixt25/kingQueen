import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Users } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate('/admin/login');
  };

  const handlePlayerClick = () => {
    navigate('/register');
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
        <p className="text-sm text-foreground/60 mt-8">
          🌊 Beach Volleyball Tournament Tracker 🏖️
        </p>
      </div>
    </div>
  );
}

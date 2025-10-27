import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser, isAdmin as checkIsAdmin, checkTournamentRegistration } from "@/utils/authUtils";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isTournamentRegistered, setIsTournamentRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const user = await getCurrentUser();
      const adminStatus = await checkIsAdmin();
      
      setIsAdminUser(adminStatus);
      
      // Admin users always have access
      if (adminStatus) {
        setIsAuthenticated(true);
        setIsTournamentRegistered(true);
        return;
      }
      
      // For regular users, check if they're authenticated AND registered for tournament
      if (user?.email) {
        setIsAuthenticated(true);
        
        // Check if user is registered in the tournament database
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .eq('is_confirmed', true)
          .single();
        
        if (player) {
          setIsTournamentRegistered(true);
          // Store registration data locally for consistency
          localStorage.setItem('tournament_registered_email', user.email.toLowerCase());
          localStorage.setItem('tournament_registered_name', player.name);
        } else {
          setIsTournamentRegistered(false);
        }
      } else {
        // Check for local registration as fallback (for email-only registrations)
        const registeredEmail = localStorage.getItem('tournament_registered_email');
        const registeredName = localStorage.getItem('tournament_registered_name');
        
        if (registeredEmail && registeredName) {
          setIsAuthenticated(true);
          setIsTournamentRegistered(true);
        } else {
          setIsAuthenticated(false);
          setIsTournamentRegistered(false);
        }
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
      setIsTournamentRegistered(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Verifying Access...
          </h2>
          <p className="text-foreground/70 font-medium">🌊 Checking your tournament registration 🏖️</p>
        </div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Redirect to landing page if not registered for tournament (unless admin)
  if (isAuthenticated && !isTournamentRegistered && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // Redirect to landing page if admin access is required but user is not admin
  if (adminOnly && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser, isAdmin as checkIsAdmin, validateUserAccess } from "@/utils/authUtils";
import { db } from "@/config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

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
      // Use the new validateUserAccess function for cleaner logic
      const accessData = await validateUserAccess();
      
      // Check admin status separately
      const adminStatus = await checkIsAdmin();
      setIsAdminUser(adminStatus);
      
      // Admin users always have access
      if (adminStatus) {
        setIsAuthenticated(true);
        setIsTournamentRegistered(true);
        return;
      }
      
      setIsAuthenticated(accessData.isAuthenticated);
      setIsTournamentRegistered(accessData.isRegistered);
      
      // Store registration data if user is registered
      if (accessData.playerData && accessData.isRegistered) {
        localStorage.setItem('tournament_registered_email', accessData.user?.email?.toLowerCase() || '');
        localStorage.setItem('tournament_registered_name', accessData.playerData?.name || '');
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
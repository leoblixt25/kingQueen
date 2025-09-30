import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/AuthModal";
import { getCurrentUser, isAdmin as checkIsAdmin, signOut } from "@/utils/authUtils";
import { supabase } from "@/integrations/supabase/client";

export default function Landing() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [availableSpots, setAvailableSpots] = useState<{ gender: string; available_spots: number; total_spots: number; }[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRegistrationRequired, setShowRegistrationRequired] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthenticationStatus();
    loadAvailableSpots();
    handleAuthCallback();
  }, [navigate]);

  const handleAuthCallback = async () => {
    // Handle OAuth callback from Google
    const urlParams = new URLSearchParams(window.location.search);
    const intent = urlParams.get('intent');
    
    if (urlParams.get('auth') === 'callback' || intent) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if this was a registration intent
          if (intent === 'register') {
            // User came from registration - check if they need to complete tournament registration
            const { data: player } = await supabase
              .from('players')
              .select('*')
              .eq('email', user.email?.toLowerCase())
              .eq('is_confirmed', true)
              .single();
            
            if (!player) {
              // User needs to complete tournament registration
              // Show the registration form but keep them authenticated
              setCurrentUser(user);
              setShowRegistrationRequired(true);
              setIsCheckingAuth(false);
              // Clear the URL params
              window.history.replaceState({}, document.title, window.location.pathname);
              return;
            }
          }
          
          // Redirect to tournament page after successful auth
          // Clear the URL params
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/tournament', { replace: true });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        // Clear the URL params on error
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  const checkAuthenticationStatus = async () => {
    try {
      const user = await getCurrentUser();
      const adminStatus = checkIsAdmin();
      
      setCurrentUser(user);
      
      // Admin users always get access
      if (adminStatus) {
        navigate('/tournament', { replace: true });
        return;
      }
      
      // For regular users, check if they're registered for tournament
      if (user?.email) {
        // Check if user is registered in the tournament database
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .eq('is_confirmed', true)
          .single();
        
        if (player) {
          // User is registered, redirect to tournament
          navigate('/tournament', { replace: true });
          return;
        }
        // If user is authenticated but not registered, show registration required message
        setShowRegistrationRequired(true);
      }
      
      setIsCheckingAuth(false);
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsCheckingAuth(false);
    }
  };

  const loadAvailableSpots = async () => {
    try {
      const { data: spots, error } = await (supabase as any)
        .rpc('get_available_spots');
        
      if (error) throw error;
      
      setAvailableSpots(spots || [
        { gender: 'male', available_spots: 8, total_spots: 8 },
        { gender: 'female', available_spots: 8, total_spots: 8 }
      ]);
    } catch (error) {
      console.error('Error loading available spots:', error);
      // Default values
      setAvailableSpots([
        { gender: 'male', available_spots: 8, total_spots: 8 },
        { gender: 'female', available_spots: 8, total_spots: 8 }
      ]);
    }
  };

  const handleAuthSuccess = (user: any, isAdmin?: boolean) => {
    if (isAdmin) {
      // For admin users, redirect to tournament page with admin controls
      navigate('/tournament', { replace: true });
    } else {
      // For regular users, redirect to tournament page
      navigate('/tournament', { replace: true });
    }
  };

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Loading...
          </h2>
          <p className="text-foreground/70 font-medium">🌊 Checking your access 🏖️</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-md mx-auto pt-4 pb-8">
        <div className="text-center mb-6 animate-fade-in">
          <div className="text-4xl md:text-6xl mb-3 animate-bounce-gentle">🏐</div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-3 drop-shadow-sm">
            King & Queen of the Beach
          </h1>
          <div className="w-16 h-1 bg-sunset mx-auto rounded-full mb-3"></div>
          <p className="text-sm md:text-base text-foreground/70 font-medium">
            🌊 Beach Volleyball Tournament Tracker 🏖️
          </p>
          {showRegistrationRequired ? (
            <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-left sm:text-left">
                  <p className="text-xs sm:text-sm text-orange-800 font-medium">
                    👋 Welcome back, {currentUser?.email}!
                  </p>
                  <p className="text-xs sm:text-sm text-orange-700 mt-1">
                    Please complete your tournament registration below.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    setCurrentUser(null);
                    setShowRegistrationRequired(false);
                  }}
                  className="text-xs self-start sm:self-auto"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs md:text-sm text-foreground/60 mt-2">
              Please sign in to access the tournament
            </p>
          )}
        </div>
        
        <AuthModal 
          onClose={() => {}} // Empty function since we don't want users to close this
          onSuccess={handleAuthSuccess}
          availableSpots={availableSpots}
          googleUser={showRegistrationRequired ? currentUser : undefined}
          showGoogleRegistrationForm={showRegistrationRequired && currentUser}
        />
      </div>
    </div>
  );
}
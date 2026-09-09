import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, LogIn, UserPlus, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { signOut } from "@/utils/authUtils";
import { collection, getDocs, query, where } from "firebase/firestore";
import MainTitle from "@/components/MainTitle";
import TournamentFinished from "@/components/TournamentFinished";
import { useTournamentFinished } from "@/hooks/useTournamentFinished";

export default function PlayerAccess() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const tournamentFinished = useTournamentFinished();
  const tournamentFinishedRef = useRef(tournamentFinished);
  useEffect(() => {
    tournamentFinishedRef.current = tournamentFinished;
  }, [tournamentFinished]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = auth.currentUser;
      setCurrentUser(user);
      
      if (user) {
        // Check if user is already registered for the tournament (any status)
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('email', '==', user.email?.toLowerCase() || ''));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const player = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
          if (player.email) localStorage.setItem('tournament_registered_email', player.email.toLowerCase());
          if (player.name) localStorage.setItem('tournament_registered_name', player.name);

          if (player.status === 'approved' || player.is_confirmed === true) {
            // Player is approved, redirect to their division
            toast({
              title: "Welcome Back!",
              description: "You're already registered. Redirecting to tournament...",
            });
            setTimeout(() => {
              if (!tournamentFinishedRef.current) {
                navigate(`/tournament/${player.gender}`);
              }
            }, 1000);
          } else {
            // Pending or reserve — keep showing their status
            toast({
              title: "Registration Pending",
              description: "Your registration is pending approval. Taking you to your status page...",
            });
            setTimeout(() => {
              if (!tournamentFinishedRef.current) {
                navigate('/pending-approval');
              }
            }, 1000);
          }
          return;
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    navigate('/sign-in');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('tournament_registered_email');
      localStorage.removeItem('tournament_registered_name');
      setCurrentUser(null);
      toast({
        title: "Signed Out",
        description: "You've been signed out successfully.",
      });
      navigate('/player-access');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Tournament Switch Off Mode: player access disabled for the public
  if (tournamentFinished) {
    return <TournamentFinished />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Loading...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="text-6xl mb-6 animate-bounce-gentle">🏐</div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-8">
          <MainTitle />
        </div>

        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardHeader>
              <CardTitle className="text-center text-ocean font-bold flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                {/* Player Access */}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleSignIn}
                className="w-full py-6 text-lg font-semibold bg-ocean hover:bg-ocean-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>
              
              <Button
                onClick={handleRegister}
                className="w-full py-6 text-lg font-semibold bg-sunset hover:bg-sunset-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
              >
                <UserPlus className="w-5 h-5" />
                Register
              </Button>
            </CardContent>
          </Card>
          
          {currentUser && (
            <Alert className="border-blue-300 bg-blue-100">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-700">
                <p className="font-medium">Signed In</p>
                <p className="text-sm mt-1">
                  You're currently signed in as {currentUser.email}. 
                  {currentUser.email.includes('@') && (
                    <>
                      {' '}You can sign in or register with this account.
                    </>
                  )}
                </p>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="mt-3 w-full border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                >
                  <LogIn className="w-4 h-4 mr-2 rotate-180" />
                  Sign Out
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="mt-8 text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
          <p className="mt-2 text-xs">
            Sign in if you already have an account, or register for a new one.
          </p>
        </div>
      </div>
    </div>
  );
}
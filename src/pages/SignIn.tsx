import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronLeft,
  Info,
  AlertCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { signInWithGoogle, signInWithApple, getCurrentUserTournamentData } from "@/utils/authUtils";

// Sign In Page - Google & Apple OAuth only (No magic link)
export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const redirectMode = searchParams.get('mode');

  useEffect(() => {
    // Handle auth callback from Google or Apple sign-in
    const handleAuthCallback = async () => {
      const authParam = searchParams.get('auth');
      if (authParam === 'google') {
        await handleGoogleAuthCallback();
      } else if (authParam === 'apple') {
        await handleAppleAuthCallback();
      }
    };
    
    handleAuthCallback();
  }, [searchParams]);

  const handleGoogleAuthCallback = async () => {
    try {
      const player = await getCurrentUserTournamentData();
      
      if (player && player.is_confirmed) {
        toast({
          title: "Welcome Back!",
          description: "You're already registered. Redirecting to tournament...",
        });
        
        setTimeout(() => {
          navigate(`/tournament/${player.gender}`);
        }, 1500);
      } else {
        toast({
          title: "Account Signed In!",
          description: "You're signed in but not registered for this tournament. Redirecting to registration...",
        });
        
        setTimeout(() => {
          navigate('/register');
        }, 2000);
      }
    } catch (error) {
      console.error('Error in Google auth callback:', error);
      toast({
        title: "Error",
        description: "An error occurred during authentication. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAppleAuthCallback = async () => {
    try {
      const player = await getCurrentUserTournamentData();
      
      if (player && player.is_confirmed) {
        toast({
          title: "Welcome Back!",
          description: "You're already registered. Redirecting to tournament...",
        });
        
        setTimeout(() => {
          navigate(`/tournament/${player.gender}`);
        }, 1500);
      } else {
        toast({
          title: "Account Signed In!",
          description: "You're signed in but not registered for this tournament. Redirecting to registration...",
        });
        
        setTimeout(() => {
          navigate('/register');
        }, 2000);
      }
    } catch (error) {
      console.error('Error in Apple auth callback:', error);
      toast({
        title: "Error",
        description: "An error occurred during authentication. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google.",
        });
        
        // Check tournament registration and redirect accordingly
        const player = await getCurrentUserTournamentData();
        
        if (player && player.is_confirmed) {
          setTimeout(() => {
            navigate(`/tournament/${player.gender}`);
          }, 1000);
        } else {
          setTimeout(() => {
            navigate('/register');
          }, 1000);
        }
      } else {
        toast({
          title: "Google Sign In Failed",
          description: result.error || "Failed to sign in with Google.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      
      if (result.success) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Apple.",
        });
        
        // Check tournament registration and redirect accordingly
        const player = await getCurrentUserTournamentData();
        
        if (player && player.is_confirmed) {
          setTimeout(() => {
            navigate(`/tournament/${player.gender}`);
          }, 1000);
        } else {
          setTimeout(() => {
            navigate('/register');
          }, 1000);
        }
      } else {
        toast({
          title: "Apple Sign In Failed",
          description: result.error || "Failed to sign in with Apple.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoBack = () => {
    if (redirectMode === 'player-access') {
      navigate('/player-access');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="absolute left-4 top-4 text-foreground/70 hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-2 drop-shadow-sm">
            King & Queen of the Beach
          </h1>
        </div>
        
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-ocean flex items-center justify-center gap-2">
              Sign In to Your Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6 border-ocean/30 bg-ocean/10">
              <Info className="h-4 w-4 text-ocean" />
              <AlertDescription className="text-ocean-dark">
                <p className="font-medium mb-1">Tournament Access Only</p>
                <p className="text-sm">
                  You must be registered for the tournament to access matchups and rankings.
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full touch-target font-semibold py-3 transition-all duration-300 bg-white/70 hover:bg-red-50 hover:text-red-700 border-red-200 text-red-600"
              >
                {isGoogleLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleAppleSignIn}
                disabled={isAppleLoading}
                className="w-full touch-target font-semibold py-3 transition-all duration-300 bg-black hover:bg-gray-800 text-white border-gray-700"
              >
                {isAppleLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Continue with Apple
                  </>
                )}
              </Button>
            </div>

            <Alert className="mt-6 border-sunset/30 bg-sunset/10">
              <AlertCircle className="h-4 w-4 text-sunset" />
              <AlertDescription className="text-sunset-dark">
                <p className="font-medium mb-1">Not Registered Yet?</p>
                <p className="text-sm">
                  If you don't have an account, please go back and select "Register" instead.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
        </div>
      </div>
    </div>
  );
}

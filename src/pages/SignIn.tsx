import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mail, 
  Lock, 
  LogIn, 
  ChevronLeft, 
  Eye, 
  EyeOff,
  Info
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { signInWithEmail, signInWithGoogle, isAdmin, getCurrentUserTournamentData } from "@/utils/authUtils";

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const redirectMode = searchParams.get('mode');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmail(formData.email, formData.password);
      
      if (result.success) {
        toast({
          title: "Welcome Back!",
          description: "Signing you in...",
        });
        
        // Check if user is registered for the tournament
        checkTournamentRegistrationAndRedirect(result.user);
      } else {
        toast({
          title: "Sign In Failed",
          description: result.error || "Please check your credentials and try again.",
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
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        toast({
          title: "Redirecting to Google...",
          description: "Please complete the authentication process.",
        });
        // The redirect will happen automatically
      } else {
        // Handle specific Google provider error
        if (result.error?.includes('provider is not enabled') || result.error?.includes('Unsupported provider')) {
          toast({
            title: "Google Sign-In Not Available",
            description: "Google authentication is currently disabled. Please use email authentication instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Google Sign In Failed",
            description: result.error || "Failed to initialize Google sign in.",
            variant: "destructive",
          });
        }
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

  const checkTournamentRegistrationAndRedirect = async (user: any) => {
    try {
      // Check if user is registered in the tournament
      const player = await getCurrentUserTournamentData();
      
      if (player && player.is_confirmed) {
        // Player is already registered, redirect to their division
        toast({
          title: "Welcome Back!",
          description: "You're already registered. Redirecting to tournament...",
        });
        
        setTimeout(() => {
          navigate(`/tournament/${player.gender}`);
        }, 1500);
      } else {
        // Player is not registered, show a message and allow registration
        toast({
          title: "Account Signed In!",
          description: "You're signed in but not registered for this tournament. Please complete registration.",
        });
        
        // Navigate to registration if not in redirect mode
        if (!redirectMode) {
          setTimeout(() => {
            navigate('/register');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking tournament registration:', error);
      // If there's an error, allow registration
      toast({
        title: "Account Signed In!",
        description: "You're signed in but not registered for this tournament. Please complete registration.",
      });
      
      if (!redirectMode) {
        setTimeout(() => {
          navigate('/register');
        }, 2000);
      }
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
              <LogIn className="w-6 h-6" />
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean pl-10"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean pl-10 pr-10"
                      placeholder="Enter your password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0 h-auto"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-foreground/60">Or continue with</span>
              </div>
            </div>

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

            <Alert className="mt-6 border-sunset/30 bg-sunset/10">
              <Info className="h-4 w-4 text-sunset" />
              <AlertDescription className="text-sunset-dark">
                <p className="font-medium mb-1">Need to Register?</p>
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
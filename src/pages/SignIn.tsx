import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronLeft,
  Info,
  Mail,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { signInWithGoogle, signInWithEmail } from "@/utils/authUtils";
import { getCurrentUserTournamentData } from "@/utils/authUtils";
import MainTitle from "@/components/MainTitle";
import TournamentFinished from "@/components/TournamentFinished";
import { useTournamentFinished } from "@/hooks/useTournamentFinished";

export default function SignIn() {
  const navigate = useNavigate();
  const tournamentFinished = useTournamentFinished();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectMode = searchParams.get('mode');

  const redirectAfterSignIn = (player: any) => {
    // Restore localStorage so /pending-approval can show this player's status
    if (player?.email) localStorage.setItem('tournament_registered_email', player.email.toLowerCase());
    if (player?.name) localStorage.setItem('tournament_registered_name', player.name);

    if (player && (player.status === 'approved' || player.is_confirmed === true)) {
      setTimeout(() => {
        navigate(`/tournament/${player.gender}`);
      }, 1000);
    } else if (player) {
      // Pending or reserve — keep showing the pending/status message
      setTimeout(() => {
        navigate('/pending-approval');
      }, 1000);
    } else {
      setTimeout(() => {
        navigate('/register');
      }, 1000);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsEmailLoading(true);
    try {
      const result = await signInWithEmail(formData.email, formData.password);
      
      if (result.success) {
        // Check tournament registration and redirect
        const player = await getCurrentUserTournamentData();
        redirectAfterSignIn(player);
      } else {
        toast({
          title: "Sign In Failed",
          description: result.error || "Please check your credentials",
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
      setIsEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        // Check tournament registration and redirect
        const player = await getCurrentUserTournamentData();
        redirectAfterSignIn(player);
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

  const handleGoBack = () => {
    if (redirectMode === 'player-access') {
      navigate('/player-access');
    } else {
      navigate('/');
    }
  };

  if (tournamentFinished) {
    return <TournamentFinished />;
  }

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
          <div className="w-full max-w-2xl mx-auto text-center px-4 mb-2">
            <MainTitle />
          </div>
        </div>
        
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-ocean">
              Sign In to Your Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Email/Password Form */}
            <form onSubmit={handleSignIn} className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  Email Address
                </Label>
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
                <Label htmlFor="password" className="text-foreground font-medium">
                  Password
                </Label>
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-foreground/50" />
                    ) : (
                      <Eye className="h-4 w-4 text-foreground/50" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isEmailLoading}
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
              >
                {isEmailLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
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

            {/* Google Sign-In Button */}
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
                <p className="font-medium mb-1">Don't have an account?</p>
                <p className="text-sm">
                  Go back and select "Register" to create a new account.
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

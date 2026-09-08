import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, LogIn, Info, Eye, EyeOff } from "lucide-react";
import { isAdmin, signInWithGoogle, adminSignInWithEmail } from "@/utils/authUtils";
import { auth } from "@/config/firebase";
import { signOut } from "firebase/auth";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting login with email:", email);
      
      // Sign in with Firebase Auth
      await adminSignInWithEmail(email, password);

      console.log("Login successful, checking admin status...");
      
      // Check if user has admin privileges
      const isAdminUser = await isAdmin();
      console.log("Admin check result:", isAdminUser);
      
      if (!isAdminUser) {
        throw new Error("Access denied. Please check your credentials.");
      }

      toast({
        title: "Success",
        description: "Logged in as administrator",
      });
      
      navigate('/admin/control');
    } catch (error: any) {
      console.error("Login error:", error);
      const genericErrorMessage = "Invalid login credentials. Please check your email and password.";
      setError(genericErrorMessage);
      toast({
        title: "Login Failed",
        description: genericErrorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        // Check if user has admin privileges
        const isAdminUser = await isAdmin();
        
        if (!isAdminUser) {
          // Sign out the unauthorized user
          await signOut(auth);
          
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Success",
          description: "Logged in as administrator",
        });
        
        navigate('/admin/control');
      } else {
        // Handle specific Google provider error
        if (result.error?.includes('provider is not enabled') || result.error?.includes('Unsupported provider')) {
          toast({
            title: "Google Sign-In Not Available",
            description: "Google authentication is currently disabled. Please use email login instead.",
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
      setIsLoading(false);
    }
  };

  // Check for Google auth callback
  const checkGoogleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'google') {
      try {
        setIsLoading(true);
        
        // Get the current user
        const user = auth.currentUser;
        
        if (user) {
          // Check if user has admin privileges
          const isAdminUser = await isAdmin();
          
          if (!isAdminUser) {
            // Sign out the unauthorized user
            await signOut();
            
            setError("Access denied.");
            toast({
              title: "Access Denied",
              description: "Access denied.",
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "Success",
            description: "Logged in as administrator",
          });
          
          navigate('/admin/control');
        }
      } catch (error: any) {
        console.error("Google auth callback error:", error);
        setError("Access denied.");
        toast({
          title: "Authentication Error",
          description: "Access denied.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Check for Google auth callback on component mount
  useEffect(() => {
    checkGoogleAuthCallback();
  }, []);

  useEffect(() => {
    // Check if user is already logged in as admin
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const isAdminUser = await isAdmin();
        if (isAdminUser) {
          navigate('/admin/control');
        }
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-ocean">
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/70 border-sand-dark/30 focus:border-ocean"
                  placeholder="admin@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/70 border-sand-dark/30 focus:border-ocean pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <Alert className="border-coral/30 bg-coral/10">
                  <AlertCircle className="h-4 w-4 text-coral" />
                  <AlertDescription className="text-coral-dark">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              

              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Login
                    </>
                  )}
                </Button>
              </div>
              
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full mt-4 text-xs sm:text-sm py-2 sm:py-3"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => {
                  // Create a test admin account
                  console.log("Creating test admin account");
                  toast({
                    title: "Info",
                    description: "To create an admin account, register through the player registration first, then contact support to assign admin privileges.",
                  });
                }}
                className="text-sm text-foreground/60"
              >
                Need an admin account?
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
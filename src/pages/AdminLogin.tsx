import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, LogIn, Info, Eye, EyeOff } from "lucide-react";
import { isAdmin } from "@/utils/authUtils";

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
      
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase login error:", error);
        throw error;
      }

      console.log("Login successful, checking admin status...");
      
      // Check if user has admin privileges
      const isAdminUser = await isAdmin();
      console.log("Admin check result:", isAdminUser);
      
      if (!isAdminUser) {
        // Sign out the user since they're not an admin
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges required.");
      }

      toast({
        title: "Success",
        description: "Logged in as administrator",
      });
      
      navigate('/admin/control');
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage = error.message || "Invalid credentials or insufficient privileges";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

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
              
              <Alert className="border-sunset/30 bg-sunset/10">
                <Info className="h-4 w-4 text-sunset" />
                <AlertDescription className="text-sunset-dark">
                  <p className="font-medium mb-1">Admin Access Required</p>
                  <p className="text-sm">
                    Only users with admin privileges can access this panel.
                    Your user ID must be d2ddca83-929d-47cb-bf76-a0d364429b0a
                    or email must be leo.blixt77@gmail.com
                  </p>
                </AlertDescription>
              </Alert>
              
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
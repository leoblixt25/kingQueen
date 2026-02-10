import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Crown, Users, Calendar, AlertCircle, CheckCircle, LogIn, UserPlus, Mail, Info } from "lucide-react";
import { registerPlayerToSlot } from "@/utils/placeholderUtils";
import { AuthModal } from "@/components/AuthModal";
import { getCurrentUser, isAdmin, adminSignOut } from "@/utils/authUtils";

interface AvailableSpots {
  gender: string;
  available_spots: number;
  total_spots: number;
  registered_count?: number;
}

interface TournamentSettings {
  tournament_date: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
}

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    gender: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSpots, setAvailableSpots] = useState<AvailableSpots[]>([]);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const checkGoogleAuthSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && user.email) {
        // User is already authenticated via Google or other method
        // Pre-fill the email field if it's empty
        if (!formData.email) {
          setFormData(prev => ({
            ...prev,
            email: user.email
          }));
        }
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error checking auth session:', error);
    }
  };

  useEffect(() => {
    checkRegistrationStatus();
    loadRegistrationData();
    handleAuthCallback();
    checkGoogleAuthSession();
  }, []);

  // Refresh available spots when settings change
  useEffect(() => {
    if (settings && availableSpots.length === 0) {
      loadAvailableSpots(settings.max_players_per_gender || 8);
    }
  }, [settings]);

  const checkRegistrationStatus = async () => {
    try {
      // Check if user is already authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if user is registered in the tournament
        const { data: player, error } = await supabase
          .from('players')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .eq('is_confirmed', true)
          .single();
          
        if (player) {
          // Player is already registered, redirect to tournament
          setCurrentUser(user);
          
          // Check if user is admin
          const adminStatus = await isAdmin();
          setUserIsAdmin(adminStatus);
          
          toast({
            title: "Welcome Back!",
            description: "You're already registered. Redirecting to tournament...",
          });
          
          setTimeout(() => {
            navigate(`/tournament/${player.gender}`);
          }, 1000);
          
          return;
        }
      }
      
      // Check for local registration data as fallback
      const registeredEmail = localStorage.getItem('tournament_registered_email');
      const registeredName = localStorage.getItem('tournament_registered_name');
      
      if (registeredEmail && registeredName) {
        // Check if user exists in the database
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('email', registeredEmail)
          .eq('is_confirmed', true)
          .single();
          
        if (player) {
          // Player is already registered, redirect to tournament
          toast({
            title: "Welcome Back!",
            description: "You're already registered. Redirecting to tournament...",
          });
          
          setTimeout(() => {
            navigate(`/tournament/${player.gender}`);
          }, 1000);
          
          return;
        }
      }
      
      // If no existing registration found, continue to registration form
      setCurrentUser(user || null);
    } catch (error) {
      console.error('Error checking registration status:', error);
      // Continue to registration form even if there's an error
    }
  };

  const handleAuthCallback = async () => {
    // Handle OAuth callback from Google or email confirmation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'callback' || urlParams.get('auth') === 'google') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          // Pre-fill the email field if it's empty
          if (!formData.email) {
            setFormData(prev => ({
              ...prev,
              email: user.email
            }));
          }
          
          // Check if user is registered for the tournament
          const { data: player } = await supabase
            .from('players')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .eq('is_confirmed', true)
            .single();
            
          if (player) {
            // Player is already registered, redirect to their division
            toast({
              title: "Welcome Back!",
              description: "You're already registered. Redirecting to tournament...",
            });
            
            setTimeout(() => {
              navigate(`/tournament/${player.gender}`);
            }, 1000);
          } else {
            // Player is not registered, show a message and allow registration
            toast({
              title: "Account Signed In!",
              description: "You're signed in but not registered for this tournament. Please complete registration.",
            });
            
            // Keep user on the registration page to complete registration
            if (user.email && !formData.email) {
              setFormData(prev => ({
                ...prev,
                email: user.email
              }));
            }
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
      }
    }
  };

  const handleAuthSuccess = (user: any, isAdminUser = false) => {
    setCurrentUser(user);
    
    // Pre-fill the email field if it's empty
    if (user.email && !formData.email) {
      setFormData(prev => ({
        ...prev,
        email: user.email
      }));
    }
    
    // Check if user is already registered for the tournament
    checkTournamentRegistrationAndRedirect(user);
  };

  const handleSignOut = () => {
    if (userIsAdmin) {
      adminSignOut();
    }
    setCurrentUser(null);
    setUserIsAdmin(false);
    toast({
      title: "Signed Out",
      description: "You've been successfully signed out.",
    });
  };

  const checkTournamentRegistrationAndRedirect = async (user: any) => {
    try {
      // Check if user is registered in the tournament
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .eq('is_confirmed', true)
        .single();
        
      if (player) {
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
        
        // Keep user on the registration page to complete registration
        // The registration form will be pre-filled with their email
        if (user.email && !formData.email) {
          setFormData(prev => ({
            ...prev,
            email: user.email
          }));
        }
      }
    } catch (error) {
      console.error('Error checking tournament registration:', error);
      // If there's an error, allow registration
      toast({
        title: "Account Signed In!",
        description: "You're signed in but not registered for this tournament. Please complete registration.",
      });
      
      // Keep user on the registration page
      if (user.email && !formData.email) {
        setFormData(prev => ({
          ...prev,
          email: user.email
        }));
      }
    }
  };

  const loadRegistrationData = async () => {
    try {
      // Load tournament settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (settingsError) {
        console.error('Error loading settings:', settingsError);
        // Default settings if none found
        setSettings({
          tournament_date: new Date().toISOString(),
          max_players_per_gender: 8,
          registration_cutoff_days: 3
        });
      } else {
        setSettings(settingsData);
      }

      // Load available spots based on settings
      loadAvailableSpots(8);
    } catch (error) {
      console.error('Error loading registration data:', error);
      // Default settings if error
      setSettings({
        tournament_date: new Date().toISOString(),
        max_players_per_gender: 8,
        registration_cutoff_days: 3
      });
      loadAvailableSpots(8);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableSpots = async (maxPlayersPerGender: number) => {
    try {
      // Query the database for actual registered players
      const { count: maleCount, error: maleError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('gender', 'male')
        .eq('is_confirmed', true);

      const { count: femaleCount, error: femaleError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('gender', 'female')
        .eq('is_confirmed', true);

      // Calculate available spots based on registered players
      const maleRegisteredCount = maleCount || 0;
      const femaleRegisteredCount = femaleCount || 0;
      
      const spots = [
        { 
          gender: 'male', 
          available_spots: maxPlayersPerGender - maleRegisteredCount, 
          total_spots: maxPlayersPerGender,
          registered_count: maleRegisteredCount
        },
        { 
          gender: 'female', 
          available_spots: maxPlayersPerGender - femaleRegisteredCount, 
          total_spots: maxPlayersPerGender,
          registered_count: femaleRegisteredCount
        }
      ];
      
      setAvailableSpots(spots);
    } catch (error) {
      console.error('Error loading available spots:', error);
      // Default values
      setAvailableSpots([
        { gender: 'male', available_spots: 8, total_spots: 8, registered_count: 0 },
        { gender: 'female', available_spots: 8, total_spots: 8, registered_count: 0 }
      ]);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isGenderFull = (gender: string) => {
    const spot = availableSpots.find(s => s.gender === gender);
    return spot ? spot.available_spots <= 0 : false;
  };

  const canRegister = () => {
    // For simplicity, we'll allow registration
    // In a real app, you would check tournament date and registration cutoff
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.gender) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (isGenderFull(formData.gender)) {
      toast({
        title: "Registration Full",
        description: `${formData.gender} division is full`,
        variant: "destructive",
      });
      return;
    }

    if (!canRegister()) {
      toast({
        title: "Registration Closed",
        description: "Registration is closed for this tournament",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the new placeholder registration system
      const result = await registerPlayerToSlot(
        formData.name,
        formData.email,
        formData.gender as 'male' | 'female'
      );

      // Store registration in localStorage
      localStorage.setItem('tournament_registered_email', formData.email.trim().toLowerCase());
      localStorage.setItem('tournament_registered_name', formData.name.trim());

      // Send confirmation email (simulated)
      toast({
        title: "Registration Successful!",
        description: `You're registered for King & Queen of the Beach as ${formData.gender === 'male' ? 'Male' : 'Female'} Player ${result.position}! A confirmation email has been sent.`,
      });

      // Refresh available spots to reflect the new registration
      if (settings) {
        loadAvailableSpots(settings.max_players_per_gender || 8);
      }
      
      // Redirect to tournament page with user's gender
      navigate(`/tournament/${formData.gender}`);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let errorMessage = "An unexpected error occurred. Please try again.";
      let errorTitle = "Registration Failed";
      
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        errorTitle = "Email Already Registered";
        errorMessage = "This email is already registered for the tournament";
      } else if (error.message === 'NO_SLOTS_AVAILABLE') {
        errorTitle = "Registration Full";
        errorMessage = "All slots for this division are taken";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", email: "", gender: "" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Loading Registration...
          </h2>
        </div>
      </div>
    );
  }

  const maleSpots = availableSpots.find(s => s.gender === 'male');
  const femaleSpots = availableSpots.find(s => s.gender === 'female');

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <header className="text-center pt-8">
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-beach-gradient bg-clip-text mb-4 drop-shadow-sm">
              King & Queen of the Beach
            </h1>
            <div className="w-16 h-1 bg-sunset mx-auto rounded-full mb-6"></div>
            <h2 className="text-xl font-semibold text-ocean mb-2">Tournament Access Portal</h2>
            
            {/* Authentication Status */}
            <div className="mt-4 flex justify-center gap-2">
              {currentUser ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full">
                    <CheckCircle className="w-4 h-4" />
                    {userIsAdmin ? 'Admin' : currentUser.email}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-xs"
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="text-center text-sm text-foreground/60 mt-2">
                    Already have an account?{' '}
                    <Button
                      variant="link"
                      onClick={() => navigate('/sign-in')}
                      className="p-0 h-auto text-ocean hover:text-ocean-dark font-medium"
                    >
                      Sign in here
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tournament Type Display */}
        {settings && (
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardContent className="p-4 text-center">
              <h3 className="font-semibold text-ocean mb-2">Current Tournament</h3>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-sunset/20 text-sunset rounded-full text-sm">
                  King & Queen of the Beach
                </span>
                <span className="px-3 py-1 bg-ocean/20 text-ocean rounded-full text-sm">
                  {settings.max_players_per_gender || 8} Players per Gender
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Spots Display */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-ocean/10 border-ocean/20">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-ocean" />
              <h3 className="font-semibold text-ocean">Male Division</h3>
              <p className="text-sm text-foreground/70">
                {maleSpots?.available_spots || 0} / {maleSpots?.total_spots || 8} spots
              </p>
              {isGenderFull('male') && (
                <div className="mt-2 text-xs text-coral font-medium">FULL</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-sunset/10 border-sunset/20">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-sunset" />
              <h3 className="font-semibold text-sunset">Female Division</h3>
              <p className="text-sm text-foreground/70">
                {femaleSpots?.available_spots || 0} / {femaleSpots?.total_spots || 8} spots
              </p>
              {isGenderFull('female') && (
                <div className="mt-2 text-xs text-coral font-medium">FULL</div>
              )}
            </CardContent>
          </Card>
        </div>

        {!canRegister() && (
          <Alert className="border-coral/30 bg-coral/10">
            <AlertCircle className="h-4 w-4 text-coral" />
            <AlertDescription className="text-coral-dark">
              Registration is closed.
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="text-center text-ocean font-bold flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" />
              Player Registration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground font-medium">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                  placeholder="Enter your name"
                  disabled={!canRegister()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                  placeholder="Enter your email"
                  disabled={!canRegister() || (currentUser?.email && currentUser.email === formData.email)}
                />
                {currentUser?.email && currentUser.email === formData.email && (
                  <p className="text-xs text-muted-foreground italic">
                    Email pre-filled from your authenticated account
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-foreground font-medium">Gender Division</Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  disabled={!canRegister()}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="male" 
                      id="male" 
                      disabled={!canRegister() || isGenderFull('male')}
                    />
                    <Label 
                      htmlFor="male" 
                      className={`cursor-pointer ${isGenderFull('male') ? 'text-foreground/50' : 'text-foreground'}`}
                    >
                      Male {isGenderFull('male') && '(Full)'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="female" 
                      id="female" 
                      disabled={!canRegister() || isGenderFull('female')}
                    />
                    <Label 
                      htmlFor="female" 
                      className={`cursor-pointer ${isGenderFull('female') ? 'text-foreground/50' : 'text-foreground'}`}
                    >
                      Female {isGenderFull('female') && '(Full)'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !canRegister() || (formData.gender && isGenderFull(formData.gender))}
                  className="flex-1 touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Register
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                >
                  Cancel
                </Button>
              </div>
            </form>


          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-ocean hover:text-ocean-dark"
          >
            ← Back to Home
          </Button>
        </div>
        
        {/* Continue with Google for Enhanced Registration */}
        <Card className="bg-white/80 backdrop-blur-sm border border-ocean/20 shadow-beach">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-ocean">Continue with Google</h3>
              <p className="text-sm text-foreground/70">
                Sign up with Google for secure account access and automatic email confirmation.
              </p>
              <Button
                onClick={() => {
                  // Call the same Google authentication as in SignIn page
                  supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/register?auth=google`
                    }
                  }).then((res) => {
                    if (res.error) {
                      toast({
                        title: "Authentication Error",
                        description: res.error.message,
                        variant: "destructive",
                      });
                    }
                  });
                }}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* AuthModal removed as per simplification requirements - all auth flows now handled through dedicated pages */}
      
      <Toaster />
    </div>
  );
}
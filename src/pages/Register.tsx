import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/config/firebase";
import { getDocs, collection, query, where } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Crown, Users, Calendar, AlertCircle, CheckCircle, LogIn, UserPlus, Mail, Info } from "lucide-react";
import { registerPlayerToSlot } from "@/utils/placeholderUtils";
import { AuthModal } from "@/components/AuthModal";
import { signInWithGoogle, registerWithEmailPassword, registerWithGoogle } from "@/utils/authUtils";
import MainTitle from "@/components/MainTitle";

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
    password: "",
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
      const user = auth.currentUser;
      
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

  const findPlayerByEmail = async (email: string) => {
    try {
      const q = query(collection(db, 'players'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    } catch (e) { console.error('Error finding player by email:', e); }
    return null;
  };

  const handleExistingRegistration = (player: any) => {
    // Restore localStorage so /pending-approval can show this player's status
    if (player.email) localStorage.setItem('tournament_registered_email', player.email.toLowerCase());
    if (player.name) localStorage.setItem('tournament_registered_name', player.name);

    if (player.status === 'approved' || player.is_confirmed === true) {
      toast({
        title: "Welcome Back!",
        description: "You're already registered. Redirecting to tournament...",
      });
      setTimeout(() => navigate(`/tournament/${player.gender}`), 1000);
    } else {
      // Pending or reserve — keep showing the pending/status message
      toast({
        title: "Registration Pending",
        description: "Your registration is pending approval. Taking you to your status page...",
      });
      setTimeout(() => navigate('/pending-approval'), 1000);
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
      const user = auth.currentUser;
      
      if (user?.email) {
        // Check if user is registered in the tournament (query by email — players may have any doc id)
        const player = await findPlayerByEmail(user.email);
        setCurrentUser(user);

        if (player) {
          handleExistingRegistration(player);
          return;
        }
      }
      
      // Check for local registration data as fallback
      const registeredEmail = localStorage.getItem('tournament_registered_email');
      
      if (registeredEmail) {
        const player = await findPlayerByEmail(registeredEmail);
        
        if (player) {
          handleExistingRegistration(player);
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
        const user = auth.currentUser;
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
          const player = await findPlayerByEmail(user.email);
          
          if (player) {
            handleExistingRegistration(player);
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
    setCurrentUser(null);
    setUserIsAdmin(false);
    toast({
      title: "Signed Out",
      description: "You've been successfully signed out.",
    });
  };

  const handleGoogleSignUp = async () => {
    try {
      const result = await signInWithGoogle();
      if (result.success && result.user?.email) {
        // Pre-fill the email field with the authenticated Google account
        setFormData(prev => ({
          ...prev,
          email: result.user.email
        }));
        setCurrentUser(result.user);
        toast({
          title: "Google Account Connected!",
          description: `Signed in as ${result.user.email}. Complete your registration below — your email is locked to this account.`,
        });
      } else if (result.error) {
        toast({
          title: "Authentication Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Google sign up error:', error);
    }
  };

  const checkTournamentRegistrationAndRedirect = async (user: any) => {
    try {
      // Check if user is registered in the tournament (query by email)
      const player = await findPlayerByEmail(user.email);
      
      if (player) {
        handleExistingRegistration(player);
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
      // Load tournament settings from Firestore
      const settingsRef = collection(db, 'tournamentSettings');
      const settingsSnap = await getDocs(query(settingsRef)); // orderBy not available, just get all
      
      if (!settingsSnap.empty) {
        // Get first document (assuming only one settings doc)
        const firstDoc = settingsSnap.docs[0];
        setSettings(firstDoc.data() as any);
      } else {
        // Default settings if none found
        setSettings({
          tournament_date: new Date().toISOString(),
          max_players_per_gender: 8,
          registration_cutoff_days: 3
        });
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
      // Query Firestore for registered players
      // Occupied slots = approved players + pending (non-reserve) players holding a slot
      const maleQuery = query(collection(db, 'players'), where('gender', '==', 'male'));
      const maleSnap = await getDocs(maleQuery);

      const femaleQuery = query(collection(db, 'players'), where('gender', '==', 'female'));
      const femaleSnap = await getDocs(femaleQuery);

      const countOccupied = (snap: any) => snap.docs.filter((doc: any) => {
        const p = doc.data();
        const isActive = p.status === 'approved' || p.status === 'pending';
        return isActive && p.is_reserve !== true;
      }).length;

      const countReserve = (snap: any) => snap.docs.filter((doc: any) => {
        const p = doc.data();
        const isActive = p.status === 'approved' || p.status === 'pending';
        return isActive && p.is_reserve === true;
      }).length;

      const maleRegisteredCount = countOccupied(maleSnap);
      const femaleRegisteredCount = countOccupied(femaleSnap);
      const maleReserveCount = countReserve(maleSnap);
      const femaleReserveCount = countReserve(femaleSnap);
      
      const spots = [
        { 
          gender: 'male', 
          available_spots: maxPlayersPerGender - maleRegisteredCount, 
          total_spots: maxPlayersPerGender,
          registered_count: maleRegisteredCount,
          reserve_count: maleReserveCount
        },
        { 
          gender: 'female', 
          available_spots: maxPlayersPerGender - femaleRegisteredCount, 
          total_spots: maxPlayersPerGender,
          registered_count: femaleRegisteredCount,
          reserve_count: femaleReserveCount
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

    const isGoogleAuth = !!currentUser?.email && currentUser.email.toLowerCase() === formData.email.trim().toLowerCase();

    if (!isGoogleAuth && (!formData.password || formData.password.length < 6)) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (isGenderFull(formData.gender)) {
      toast({
        title: "Reserve Registration",
        description: `${formData.gender} division is full right now, but we will keep you as a reserve player. If someone cancels, you may get a spot.`,
      });
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
      // Register with Firebase Auth and save to Firestore
      const result = isGoogleAuth
        ? await registerWithGoogle(formData.name, formData.gender)
        : await registerWithEmailPassword(
            formData.email,
            formData.password,
            formData.name,
            formData.gender as 'male' | 'female'
          );

      if (result.success) {
        // Store registration in localStorage
        localStorage.setItem('tournament_registered_email', formData.email.trim().toLowerCase());
        localStorage.setItem('tournament_registered_name', formData.name.trim());

        if (result.isReserve) {
          toast({
            title: "Reserve Registration Submitted!",
            description: `The ${formData.gender} division is full right now, but we will keep you as a reserve player. If someone cancels, you may get a spot.`,
          });
        } else {
          toast({
            title: "Registration Pending Approval!",
            description: `Your registration has been submitted. Please wait for admin approval before accessing the tournament.`,
          });
        }

        // Refresh available spots to reflect the new registration
        if (settings) {
          loadAvailableSpots(settings.max_players_per_gender || 8);
        }
        
        // Show pending approval message instead of redirecting
        setTimeout(() => {
          navigate('/pending-approval');
        }, 1500);
      } else {
        throw new Error(result.error || 'Registration failed');
      }
      
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
    setFormData({ name: "", email: "", password: "", gender: "" });
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
            <div className="w-full max-w-2xl mx-auto text-center px-4 mb-4">
              <MainTitle />
            </div>
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
                {(maleSpots?.available_spots ?? 0) > 0
                  ? `${maleSpots?.available_spots || 0} spots available`
                  : `Reserve list - Position #${(maleSpots?.reserve_count ?? 0) + 1}`}
              </p>
              {isGenderFull('male') && (
                <div className="mt-2 text-xs text-coral font-medium">FULL - reserve available</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-sunset/10 border-sunset/20">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-sunset" />
              <h3 className="font-semibold text-sunset">Female Division</h3>
              <p className="text-sm text-foreground/70">
                {(femaleSpots?.available_spots ?? 0) > 0
                  ? `${femaleSpots?.available_spots || 0} spots available`
                  : `Reserve list - Position #${(femaleSpots?.reserve_count ?? 0) + 1}`}
              </p>
              {isGenderFull('female') && (
                <div className="mt-2 text-xs text-coral font-medium">FULL - reserve available</div>
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
                  disabled={!canRegister() || !!currentUser?.email}
                />
                {currentUser?.email && (
                  <p className="text-xs text-muted-foreground italic">
                    Email locked to your authenticated account ({currentUser.email})
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                  placeholder="Create a password (min 6 characters)"
                  disabled={!canRegister() || !!currentUser?.email}
                />
                <p className="text-xs text-muted-foreground">
                  {currentUser?.email
                    ? "Password not needed — you're signed in with Google."
                    : "Must be at least 6 characters"}
                </p>
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
                      disabled={!canRegister()}
                    />
                    <Label 
                      htmlFor="male" 
                      className={`cursor-pointer ${isGenderFull('male') ? 'text-foreground/50' : 'text-foreground'}`}
                    >
                      Male {isGenderFull('male') && '(Full - reserve)'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="female" 
                      id="female" 
                      disabled={!canRegister()}
                    />
                    <Label 
                      htmlFor="female" 
                      className={`cursor-pointer ${isGenderFull('female') ? 'text-foreground/50' : 'text-foreground'}`}
                    >
                      Female {isGenderFull('female') && '(Full - reserve)'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !canRegister()}
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
                onClick={handleGoogleSignUp}
                type="button"
                variant="outline"
                className="w-full touch-target font-semibold py-3 transition-all duration-300 bg-white/70 hover:bg-red-50 hover:text-red-700 border-red-200 text-red-600"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
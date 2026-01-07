import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, 
  Mail, 
  Lock, 
  Crown, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  LogIn,
  UserPlus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { 
  signUpWithEmail, 
  signInWithEmail, 
  signInWithGoogle, 
  adminSignIn 
} from "@/utils/authUtils";
import { PaymentWrapper } from "./PaymentWrapper";
import { registerPlayerToSlot } from "@/utils/placeholderUtils";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: any, isAdmin?: boolean) => void;
  availableSpots: { gender: string; available_spots: number; total_spots: number; }[];
  googleUser?: any; // For completing Google user registration
  showGoogleRegistrationForm?: boolean;
}

export function AuthModal({ onClose, onSuccess, availableSpots, googleUser, showGoogleRegistrationForm }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState(showGoogleRegistrationForm ? "google-complete" : "signin");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleRegistration, setIsGoogleRegistration] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);
  
  // Google registration completion form
  const [googleRegData, setGoogleRegData] = useState({
    name: googleUser?.user_metadata?.full_name || "",
    email: googleUser?.email || "",
    gender: ""
  });
  
  // Sign in form
  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });

  // Sign up form
  const [signUpData, setSignUpData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: ""
  });

  // Admin form
  const [adminData, setAdminData] = useState({
    username: "",
    password: ""
  });

  const isGenderFull = (gender: string) => {
    const spot = availableSpots.find(s => s.gender === gender);
    return spot ? spot.available_spots <= 0 : false;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInData.email || !signInData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmail(signInData.email, signInData.password);
      
      if (result.success) {
        toast({
          title: "Welcome Back!",
          description: "You've successfully signed in.",
        });
        onSuccess(result.user);
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signUpData.name || !signUpData.email || !signUpData.password || !signUpData.gender) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (isGenderFull(signUpData.gender)) {
      toast({
        title: "Registration Full",
        description: `${signUpData.gender} division is full`,
        variant: "destructive",
      });
      return;
    }

    // Skip payment for now - directly proceed with registration
    setIsLoading(true);
    try {
      const result = await signUpWithEmail(
        signUpData.email, 
        signUpData.password, 
        signUpData.name,
        signUpData.gender as 'male' | 'female'
      );
      
      if (result.success) {
        if (result.needsConfirmation) {
          toast({
            title: "Registration Successful!",
            description: "Please check your email and click the confirmation link to complete your registration.",
          });
        } else {
          toast({
            title: "Registration Complete!",
            description: `Welcome to the tournament, ${signUpData.name}!`,
          });
          onSuccess(result.user);
        }
      } else {
        toast({
          title: "Registration Failed",
          description: result.error || "Failed to register. Please try again.",
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
    setIsLoading(true);
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
            description: "Google authentication is currently disabled. Please use email registration instead.",
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

  const handleGoogleRegistration = async () => {
    if (activeTab === 'signup') {
      // For registration tab, initiate Google OAuth for registration
      setIsLoading(true);
      try {
        const result = await signInWithGoogle(`${window.location.origin}/?intent=register`);
        
        if (result.success) {
          toast({
            title: "Redirecting to Google...",
            description: "After authentication, you'll complete your tournament registration.",
          });
          // The redirect will happen automatically
        } else {
          // Handle specific Google provider error
          if (result.error?.includes('provider is not enabled') || result.error?.includes('Unsupported provider')) {
            toast({
              title: "Google Registration Not Available",
              description: "Google authentication is currently disabled. Please use email registration instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Google Registration Failed",
              description: result.error || "Failed to initialize Google registration.",
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
    } else {
      // For sign-in tab, use regular Google sign-in
      handleGoogleSignIn();
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminData.username || !adminData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminSignIn(adminData.username, adminData.password);
      
      if (result.success) {
        toast({
          title: "Admin Access Granted",
          description: "Welcome, Administrator!",
        });
        onSuccess(result.user, true);
      } else {
        toast({
          title: "Admin Login Failed",
          description: "Invalid admin credentials",
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

  const handleGoogleRegistrationComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!googleRegData.name || !googleRegData.gender) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and select a gender division",
        variant: "destructive",
      });
      return;
    }

    if (isGenderFull(googleRegData.gender)) {
      toast({
        title: "Registration Full",
        description: `${googleRegData.gender} division is full`,
        variant: "destructive",
      });
      return;
    }

    // Skip payment for now - directly proceed with Google registration
    setIsLoading(true);
    try {
      await registerPlayerToSlot(
        googleRegData.name, 
        googleRegData.email, 
        googleRegData.gender as 'male' | 'female'
      );
      
      toast({
        title: "Registration Complete!",
        description: `Welcome to the tournament, ${googleRegData.name}!`,
      });
      
      onSuccess(googleUser);
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to complete tournament registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    setIsLoading(true);
    
    try {
      if (pendingRegistrationData) {
        // Complete regular email registration after payment
        const result = await signUpWithEmail(
          pendingRegistrationData.email, 
          pendingRegistrationData.password, 
          pendingRegistrationData.name,
          pendingRegistrationData.gender as 'male' | 'female'
        );
        
        if (result.success) {
          if (result.needsConfirmation) {
            toast({
              title: "Registration Successful!",
              description: "Payment completed! Please check your email and click the confirmation link to complete your registration.",
            });
          } else {
            toast({
              title: "Registration Complete!",
              description: `Welcome to the tournament, ${pendingRegistrationData.name}!`,
            });
            onSuccess(result.user);
          }
        } else {
          toast({
            title: "Registration Failed",
            description: result.error || "Failed to complete registration after payment. Please contact support.",
            variant: "destructive",
          });
        }
      } else if (googleUser) {
        // Complete Google registration after payment
        await registerPlayerToSlot(
          googleRegData.name, 
          googleRegData.email, 
          googleRegData.gender as 'male' | 'female'
        );
        
        toast({
          title: "Registration Complete!",
          description: `Welcome to the tournament, ${googleRegData.name}!`,
        });
        
        onSuccess(googleUser);
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to complete registration after payment. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setPendingRegistrationData(null);
    }
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setPendingRegistrationData(null);
    toast({
      title: "Registration Cancelled",
      description: "Payment was cancelled. You can try again anytime.",
    });
  };

  const maleSpots = availableSpots.find(s => s.gender === 'male');
  const femaleSpots = availableSpots.find(s => s.gender === 'female');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-white/95 backdrop-blur-sm shadow-2xl my-4 sm:my-8">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl sm:text-2xl font-bold text-ocean flex items-center gap-2">
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
              Tournament Access
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${showGoogleRegistrationForm ? 'grid-cols-1' : 'grid-cols-2'} gap-1`}>
              {!showGoogleRegistrationForm && (
                <>
                  <TabsTrigger value="signin" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <LogIn className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Sign In</span>
                    <span className="sm:hidden">Sign</span>
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
                    <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Register</span>
                    <span className="sm:hidden">Join</span>
                  </TabsTrigger>
                </>
              )}
              {showGoogleRegistrationForm && (
                <TabsTrigger value="google-complete" className="flex items-center gap-1 text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  Complete Registration
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="signin" className="space-y-3 sm:space-y-4">
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Welcome Back</h3>
                <p className="text-xs sm:text-sm text-gray-600">Sign in to your tournament account</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      value={signInData.password}
                      onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      disabled={isLoading}
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-ocean hover:bg-ocean-dark text-white text-xs sm:text-sm py-2 sm:py-3"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
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
                  type="button"
                  variant="outline"
                  onClick={handleGoogleRegistration}
                  disabled={isLoading}
                  className="w-full text-xs sm:text-sm py-2 sm:py-3"
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
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 sm:space-y-4">
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Join the Tournament</h3>
                <p className="text-xs sm:text-sm text-gray-600">Create your account and register</p>
              </div>

              {/* Available Spots Display */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-ocean/10 rounded-lg text-center">
                  <p className="text-xs sm:text-sm font-medium text-ocean">Male Division</p>
                  <p className="text-xs text-gray-600">
                    {maleSpots?.available_spots || 0} / {maleSpots?.total_spots || 8} spots
                  </p>
                  {isGenderFull('male') && (
                    <div className="text-xs text-red-600 font-medium">FULL</div>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-sunset/10 rounded-lg text-center">
                  <p className="text-xs sm:text-sm font-medium text-sunset">Female Division</p>
                  <p className="text-xs text-gray-600">
                    {femaleSpots?.available_spots || 0} / {femaleSpots?.total_spots || 8} spots
                  </p>
                  {isGenderFull('female') && (
                    <div className="text-xs text-red-600 font-medium">FULL</div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3 sm:space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-blue-800 font-medium flex items-start gap-2">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>Quick Tip: Use "Continue with Google" below to skip password setup!</span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1 ml-5 sm:ml-6">
                    Google sign-in will auto-fill your email - just add your name and gender to complete registration.
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-green-800 font-medium flex items-center gap-2">
                    🎉 Registration Fee: <span className="font-bold line-through text-gray-500">$50.00</span> <span className="font-bold text-green-600">FREE</span>
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Registration is currently free! Payment system ready for future activation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Create a password (min 6 characters)"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm your password"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Gender Division</Label>
                  <RadioGroup
                    value={signUpData.gender}
                    onValueChange={(value) => setSignUpData(prev => ({ ...prev, gender: value }))}
                    disabled={isLoading}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="male" 
                        id="male-signup" 
                        disabled={isLoading || isGenderFull('male')}
                      />
                      <Label 
                        htmlFor="male-signup" 
                        className={`cursor-pointer ${isGenderFull('male') ? 'text-gray-400' : ''}`}
                      >
                        Male {isGenderFull('male') && '(Full)'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="female" 
                        id="female-signup" 
                        disabled={isLoading || isGenderFull('female')}
                      />
                      <Label 
                        htmlFor="female-signup" 
                        className={`cursor-pointer ${isGenderFull('female') ? 'text-gray-400' : ''}`}
                      >
                        Female {isGenderFull('female') && '(Full)'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    You'll receive a confirmation email after registration. Click the link to complete your tournament registration.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  disabled={isLoading || (signUpData.gender && isGenderFull(signUpData.gender))}
                  className="w-full bg-ocean hover:bg-ocean-dark text-white text-xs sm:text-sm py-2 sm:py-3"
                >
                  {isLoading ? "Creating Account..." : "Create Account & Register (FREE)"}
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
                  type="button"
                  variant="outline"
                  onClick={handleGoogleRegistration}
                  disabled={isLoading}
                  className="w-full text-xs sm:text-sm py-2 sm:py-3"
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
            </TabsContent>

            <TabsContent value="admin" className="space-y-3 sm:space-y-4">
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Administrator Access</h3>
                <p className="text-xs sm:text-sm text-gray-600">Admin login for tournament management</p>
              </div>

              <form onSubmit={handleAdminSignIn} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input
                    id="admin-username"
                    type="text"
                    value={adminData.username}
                    onChange={(e) => setAdminData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter admin username"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminData.password}
                    onChange={(e) => setAdminData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter admin password"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs sm:text-sm py-2 sm:py-3"
                >
                  <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  {isLoading ? "Authenticating..." : "Admin Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="google-complete" className="space-y-3 sm:space-y-4">
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Complete Your Registration</h3>
                <p className="text-xs sm:text-sm text-gray-600">Welcome, {googleUser?.email}! Please complete your tournament registration</p>
              </div>

              {/* Available Spots Display */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-ocean/10 rounded-lg text-center">
                  <p className="text-xs sm:text-sm font-medium text-ocean">Male Division</p>
                  <p className="text-xs text-gray-600">
                    {maleSpots?.available_spots || 0} / {maleSpots?.total_spots || 8} spots
                  </p>
                  {isGenderFull('male') && (
                    <div className="text-xs text-red-600 font-medium">FULL</div>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-sunset/10 rounded-lg text-center">
                  <p className="text-xs sm:text-sm font-medium text-sunset">Female Division</p>
                  <p className="text-xs text-gray-600">
                    {femaleSpots?.available_spots || 0} / {femaleSpots?.total_spots || 8} spots
                  </p>
                  {isGenderFull('female') && (
                    <div className="text-xs text-red-600 font-medium">FULL</div>
                  )}
                </div>
              </div>

              <form onSubmit={handleGoogleRegistrationComplete} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="google-name">Full Name</Label>
                  <Input
                    id="google-name"
                    type="text"
                    value={googleRegData.name}
                    onChange={(e) => setGoogleRegData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-email">Email (from Google)</Label>
                  <Input
                    id="google-email"
                    type="email"
                    value={googleRegData.email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Gender Division</Label>
                  <RadioGroup
                    value={googleRegData.gender}
                    onValueChange={(value) => setGoogleRegData(prev => ({ ...prev, gender: value }))}
                    disabled={isLoading}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="male" 
                        id="male-google" 
                        disabled={isLoading || isGenderFull('male')}
                      />
                      <Label 
                        htmlFor="male-google" 
                        className={`cursor-pointer ${isGenderFull('male') ? 'text-gray-400' : ''}`}
                      >
                        Male {isGenderFull('male') && '(Full)'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="female" 
                        id="female-google" 
                        disabled={isLoading || isGenderFull('female')}
                      />
                      <Label 
                        htmlFor="female-google" 
                        className={`cursor-pointer ${isGenderFull('female') ? 'text-gray-400' : ''}`}
                      >
                        Female {isGenderFull('female') && '(Full)'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Great! Your Google account is verified. Just add your name and gender to complete tournament registration.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  disabled={isLoading || (googleRegData.gender && isGenderFull(googleRegData.gender))}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm py-2 sm:py-3"
                >
                  {isLoading ? "Completing Registration..." : "Complete Tournament Registration (FREE)"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Payment Modal - Disabled for now, keeping for future use */}
      {/* {showPayment && (
        <PaymentWrapper
          amount={0} // $0.00 - payment disabled
          playerName={pendingRegistrationData?.name || googleRegData.name}
          playerEmail={pendingRegistrationData?.email || googleRegData.email}
          gender={pendingRegistrationData?.gender || googleRegData.gender}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )} */}
    </div>
  );
}
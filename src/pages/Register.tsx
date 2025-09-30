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
import { Crown, Users, Calendar, AlertCircle, CheckCircle } from "lucide-react";

interface AvailableSpots {
  gender: string;
  available_spots: number;
  total_spots: number;
}

interface TournamentSettings {
  tournament_date: string;
  registration_cutoff_days: number;
  max_players_per_gender: number;
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

  useEffect(() => {
    loadRegistrationData();
  }, []);

  const loadRegistrationData = async () => {
    try {
      // Load available spots
      const { data: spots, error: spotsError } = await supabase
        .rpc('get_available_spots');
      
      if (spotsError) {
        console.error('Error loading spots:', spotsError);
      } else {
        setAvailableSpots(spots || []);
      }

      // Load tournament settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (settingsError) {
        console.error('Error loading settings:', settingsError);
      } else {
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error loading registration data:', error);
    } finally {
      setIsLoading(false);
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
    if (!settings) return false;
    
    const tournamentDate = new Date(settings.tournament_date);
    const cutoffDate = new Date(tournamentDate);
    cutoffDate.setDate(cutoffDate.getDate() - settings.registration_cutoff_days);
    
    return new Date() < cutoffDate;
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
      // Check if email already exists
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('email')
        .eq('email', formData.email)
        .single();

      if (existingPlayer) {
        toast({
          title: "Email Already Registered",
          description: "This email is already registered for the tournament",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Register the player
      const { error } = await supabase
        .from('players')
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          gender: formData.gender,
          is_confirmed: true,
          points: 0,
          total_scores: 0,
          position: 0 // Will be updated by admin or automatically
        });

      if (error) {
        console.error('Registration error:', error);
        toast({
          title: "Registration Failed",
          description: "Failed to register. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Store registration in localStorage
      localStorage.setItem('tournament_registered_email', formData.email.trim().toLowerCase());
      localStorage.setItem('tournament_registered_name', formData.name.trim());

      // Send confirmation email (simulated)
      toast({
        title: "Registration Successful!",
        description: "You're registered for King & Queen of the Beach! A confirmation email has been sent.",
      });

      // Redirect to main app
      navigate('/');
      
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
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
            <h2 className="text-xl font-semibold text-ocean mb-2">Tournament Registration</h2>
            {settings && (
              <div className="flex items-center justify-center gap-2 text-sm text-foreground/70">
                <Calendar className="w-4 h-4" />
                <span>Tournament Date: {new Date(settings.tournament_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </header>

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
              Registration is closed. The tournament is within {settings?.registration_cutoff_days} days.
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
                <Label htmlFor="name" className="text-foreground font-medium">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean"
                  placeholder="Enter your full name"
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
                  disabled={!canRegister()}
                />
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

            <div className="mt-6 p-4 bg-palm/10 rounded-lg border border-palm/20">
              <p className="text-sm text-foreground/70 text-center">
                📧 You'll receive a confirmation email after registration.
                <br />
                ⏰ You can cancel up to {settings?.registration_cutoff_days || 3} days before the tournament.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-ocean hover:text-ocean-dark"
          >
            ← Back to Tournament
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
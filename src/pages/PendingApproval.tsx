import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db } from "@/config/firebase";
import { signOut } from "@/utils/authUtils";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Clock, Mail, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PendingApproval() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "not_found">("pending");
  const [isReserve, setIsReserve] = useState(false);
  const [reservePosition, setReservePosition] = useState<number | null>(null);

  useEffect(() => {
    checkRegistrationStatus();
    const interval = setInterval(checkRegistrationStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('tournament_registered_email');
      localStorage.removeItem('tournament_registered_name');
      toast({
        title: "Signed Out",
        description: "You've been signed out successfully.",
      });
      navigate('/player-access');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const checkRegistrationStatus = async () => {
    const email = localStorage.getItem('tournament_registered_email');
    if (!email) {
      setStatus("not_found");
      return;
    }

    try {
      const playersRef = collection(db, 'players');
      const q = query(playersRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const playerDoc = snapshot.docs[0];
        const playerData = playerDoc.data();
        
        setPlayerName(playerData.name || "");
        setPlayerEmail(playerData.email || "");
        setIsReserve(!!playerData.is_reserve);
        
        if (playerData.status === 'approved' || playerData.is_confirmed === true) {
          setStatus("approved");
          toast({
            title: "Registration Approved!",
            description: "You can now access the tournament.",
          });
          setTimeout(() => {
            navigate(`/tournament/${playerData.gender}`);
          }, 2000);
        } else {
          setStatus("pending");
        }

        if (playerData.is_reserve) {
          const genderQuery = query(playersRef, where('gender', '==', playerData.gender));
          const genderSnap = await getDocs(genderQuery);
          const reserveBefore = genderSnap.docs.filter((d) => {
            const p = d.data();
            return p.is_reserve === true && (p.status === 'approved' || p.status === 'pending') && p.email !== email.toLowerCase();
          }).length;
          setReservePosition(reserveBefore + 1);
        }
      } else {
        setStatus("not_found");
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-sand-gradient flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader>
            <CardTitle className="text-center text-coral">Registration Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-coral/30 bg-coral/10">
              <AlertDescription>
                No pending registration found. Please register first.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/register')}
              className="w-full bg-ocean hover:bg-ocean-dark text-white"
            >
              Go to Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="min-h-screen bg-sand-gradient flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-palm/20 shadow-beach">
          <CardHeader>
            <CardTitle className="text-center text-palm">🎉 Registration Approved!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-foreground/70">
              Welcome, {playerName}! You can now access the tournament.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Redirecting to tournament page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-ocean/20 shadow-beach">
        <CardHeader>
          <CardTitle className="text-center text-ocean flex items-center justify-center gap-2">
            <Clock className="w-6 h-6 animate-pulse" />
            Registration Pending Approval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className={isReserve ? "border-purple-300 bg-purple-50" : "border-ocean/30 bg-ocean/10"}>
            <AlertDescription>
              {isReserve ? (
                <>
                  Thank you for registering, <strong>{playerName || "Player"}</strong>! 
                  The division is currently full, but we will keep you as a <strong>reserve player</strong>.
                  Your position on the waiting list: <strong>#{reservePosition}</strong>.
                  If someone cancels, you may get a spot in the tournament.
                </>
              ) : (
                <>
                  Thank you for registering, <strong>{playerName || "Player"}</strong>! 
                  Your registration is currently pending admin approval.
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-ocean" />
              <span className="text-foreground/70">{playerEmail || "Your email"}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 mb-2">What happens next?</h3>
            <ul className="text-sm text-amber-700 space-y-2">
              <li>• An admin will review your registration</li>
              <li>• You'll be automatically redirected once approved</li>
              <li>• This page auto-refreshes every 5 seconds</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full border-coral/30 text-coral hover:bg-coral/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
            <Button
              onClick={checkRegistrationStatus}
              className="w-full bg-ocean hover:bg-ocean-dark text-white"
            >
              Check Status Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

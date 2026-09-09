import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Edit, Trash, Crown, ChevronLeft, ChevronRight, Home, Users, RotateCcw, UserPlus, LogOut, Loader2, Settings } from "lucide-react";
import { Gender, FinalMatchScores, ResolvedMatch } from "@/types";
import { useTournamentData } from "@/hooks/useTournamentData";
import { useTournamentRealtimeSubscriptions } from "@/hooks/useTournamentRealtimeSubscriptions";
import { PlayerUnregistration } from "@/components/PlayerUnregistration";
import { ResetConfirmationModal } from "@/components/ResetConfirmationModal";
import { ScoreResetConfirmationModal } from "@/components/ScoreResetConfirmationModal";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { auth, db } from "@/config/firebase";
import WaitingForDraw from "./WaitingForDraw";
import { collection, getDocs, query, where, writeBatch, doc, getDoc, onSnapshot } from "firebase/firestore";
import { getCurrentUser, isAdmin as checkIsAdmin, signOut, getCurrentUserTournamentData } from "@/utils/authUtils";
import { buildPlayersMap, resolveMatchPlayers } from "@/utils/matchPlayerResolver";
import { sortPlayersWithTiebreakers, getTiebreakerLevel } from "@/utils/rankingTiebreaker";
import MainTitle from "@/components/MainTitle";
import TournamentFinished from "@/components/TournamentFinished";
import { useTournamentFinished } from "@/hooks/useTournamentFinished";

interface TournamentSettings {
  id?: string;
  tournament_date: string;
  tournament_city: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
  created_at?: string;
  updated_at?: string;
}

export default function KingQueenOfTheBeach() {
  const navigate = useNavigate();
  const [gender, setGender] = useState<Gender>("female");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [showFinalMatch, setShowFinalMatch] = useState(false);
  const [isEditingFinalMatch, setIsEditingFinalMatch] = useState(false);
  const [showUnregistration, setShowUnregistration] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userGender, setUserGender] = useState<Gender | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettings | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showScoreResetModal, setShowScoreResetModal] = useState(false);
  const [isResettingScores, setIsResettingScores] = useState(false);
  const [showResetFinalMatchModal, setShowResetFinalMatchModal] = useState(false);
  const [drawCompleted, setDrawCompleted] = useState(false);
  const tournamentFinished = useTournamentFinished();
  
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [submitFeedbackMatchIndex, setSubmitFeedbackMatchIndex] = useState<number | null>(null);
  const [saveEditFeedback, setSaveEditFeedback] = useState(false);
  const [finalSubmitFeedback, setFinalSubmitFeedback] = useState(false);
  const [finalEditFeedback, setFinalEditFeedback] = useState(false);

  const {
    femalePlayers,
    malePlayers,
    femaleMatches,
    maleMatches,
    finalMatchScores,
    finalMatchSubmitted,
    finalMatchWinner,
    isLoading,
    updateMatchScore,
    updateFinalMatch: updateFinalMatchData,
    resetScores,
    resetAllData,
    retryMatchInitialization,
    setFinalMatchScores,
    loadTournamentData,
    loadPlayersData,
    loadMatchesData,
    loadFinalMatchData
  } = useTournamentData();

  // Use the individual loaders from the hook (already wrapped in useCallback)
  useTournamentRealtimeSubscriptions({
    loadPlayersData,
    loadMatchesData,
    loadFinalMatchData,
  });

  const players = gender === 'female' ? femalePlayers : malePlayers
  
  // CRITICAL: Sort players by points (descending), then totalScores (descending)
  // This ensures Rank #1 always shows the player with the most points
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.totalScores - a.totalScores;
  });
  
  // Build player points map for tiebreaker detection
  const playerPointsMap = new Map<string, number>();
  players.forEach(p => {
    if (p.id) playerPointsMap.set(p.id, p.points);
  });
  
  // Detect tiebreaker levels for display
  const getTiebreakerForPlayer = (playerIndex: number): string | null => {
    if (playerIndex === 0 || playerIndex >= sortedPlayers.length) return null;
    
    const currentPlayer = sortedPlayers[playerIndex];
    const previousPlayer = sortedPlayers[playerIndex - 1];
    
    // Only show tiebreaker if points are tied
    if (currentPlayer.points === previousPlayer.points) {
      return getTiebreakerLevel(previousPlayer, currentPlayer, matches, playerPointsMap);
    }
    
    return null;
  };
  
  // Log Championship Final pairings for debugging
  if (malePlayers.length >= 2 && femalePlayers.length >= 2) {
    console.log('🏆 [CHAMPIONSHIP FINAL] Current pairings (updated):');
    console.log('  Team 1 - Male #1:', malePlayers[0]?.name, `(${malePlayers[0]?.points}pts)`, '& Female #2:', femalePlayers[1]?.name, `(${femalePlayers[1]?.points}pts)`);
    console.log('  Team 2 - Female #1:', femalePlayers[0]?.name, `(${femalePlayers[0]?.points}pts)`, '& Male #2:', malePlayers[1]?.name, `(${malePlayers[1]?.points}pts)`);
    console.log('  🕐 Updated at:', new Date().toLocaleTimeString());
  }
  
  // Build players map and resolve match player IDs to actual player data
  // SAFE: resolveMatchPlayers uses strict validation that THROWS on any mismatch.
  // A throw during render (e.g. matches snapshot arriving before players load)
  // would blank the whole page, so resolution is guarded and never fatal.
  const playersMap = buildPlayersMap(femalePlayers, malePlayers);
  let resolvedFemaleMatches: ResolvedMatch[] = [];
  let resolvedMaleMatches: ResolvedMatch[] = [];
  if (playersMap.size > 0) {
    try {
      resolvedFemaleMatches = resolveMatchPlayers(femaleMatches, playersMap);
      resolvedMaleMatches = resolveMatchPlayers(maleMatches, playersMap);
    } catch (resolveError) {
      console.error('❌ [MATCH RESOLVE] Resolution failed during render (recovering):', resolveError);
      resolvedFemaleMatches = [];
      resolvedMaleMatches = [];
    }
  }
  const matches = gender === 'female' ? resolvedFemaleMatches : resolvedMaleMatches

  // HARD SAFETY CHECK: If draw is completed but no matches exist, log CRITICAL ERROR
  // NOTE: This must NOT throw — draw_completed can become true (settings snapshot)
  // before matches finish loading, and a throw during render would blank the whole page.
  const totalMatchCount = resolvedFemaleMatches.length + resolvedMaleMatches.length;
  if (drawCompleted && totalMatchCount === 0) {
    console.error('❌❌❌ CRITICAL ERROR ❌❌❌');
    console.error('Draw is marked as completed but NO MATCHES exist in Firestore!');
    console.error('This indicates a data integrity failure.');
    console.error('Possible causes:');
    console.error('  1. Matches were deleted after draw completion');
    console.error('  2. Match generation failed silently');
    console.error('  3. Player IDs changed (e.g., new test players loaded)');
  }

  // Use deterministic tiebreaker system for final rankings
  const rankedPlayers = sortPlayersWithTiebreakers(players, matches);

  // Initialize user state on mount
  useEffect(() => {
    initializeUserState();
    loadTournamentSettings();
  }, []);

  // Check if draw is completed for approved non-admin users
  useEffect(() => {
    if (!userIsAdmin && (currentUser || localStorage.getItem('tournament_registered_email'))) {
      const unsub = onSnapshot(
        doc(db, 'tournamentSettings', 'settings'),
        snap => {
          if (snap.exists() && snap.data()?.draw_completed === true) {
            setDrawCompleted(true);
          }
        }
      );
      return () => unsub();
    }
  }, [userIsAdmin, currentUser]);

  // Auto-retry loading if stuck for too long
  useEffect(() => {
    if (isLoading && !isLoadingUserData) {
      console.log('⏱️ [AUTO-RETRY] Setting up auto-retry timer...');
      
      // If loading takes more than 8 seconds, automatically retry
      const retryTimer = setTimeout(() => {
        console.log('⏱️ [AUTO-RETRY] Loading took too long, automatically reloading data...');
        loadTournamentData();
      }, 8000);
      
      return () => {
        clearTimeout(retryTimer);
      };
    }
  }, [isLoading, isLoadingUserData, loadTournamentData]);

  // Auto-retry if matches are empty after loading completes
  // CRITICAL: Only retry when the draw is completed but matches are missing (data integrity).
  // While the draw is pending, empty matches are NORMAL for approved players waiting on WaitingForDraw —
  // retrying there would blink the page between the loading screen and the countdown every few seconds.
  useEffect(() => {
    if (!isLoading && drawCompleted && (!matches || matches.length === 0)) {
      console.log('⏱️ [AUTO-RETRY-MATCHES] Loading finished but no matches, setting up retry...');
      
      const retryTimer = setTimeout(() => {
        console.log('⏱️ [AUTO-RETRY-MATCHES] Still no matches, reloading data...');
        loadTournamentData();
      }, 3000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [matches, isLoading, drawCompleted, loadTournamentData]);

  // Auto-jump to next unfinished match when matches load
  useEffect(() => {
    if (!matches || matches.length === 0) return;

    const savedIndex = localStorage.getItem(`lastMatchIndex_${gender}`);
    if (savedIndex) {
      setCurrentMatchIndex(Number(savedIndex));
      return;
    }

    const nextUnfinishedIndex = matches.findIndex(m => !m.isSubmitted);
    if (nextUnfinishedIndex !== -1) {
      setCurrentMatchIndex(nextUnfinishedIndex);
      console.log('⏭️ [AUTO-NAV] Jumped to next unfinished match:', nextUnfinishedIndex);
    }
  }, [matches, gender]);

  // Update gender based on URL if it changes
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const urlGender = pathParts[pathParts.length - 1];
    
    if (['male', 'female'].includes(urlGender)) {
      const selectedGender = urlGender as Gender;
      setGender(selectedGender);
      // Don't clear - each gender has its own saved index
      
      // For regular users, only allow access to their registered division
      if (!userIsAdmin && userGender && userGender !== selectedGender) {
        toast({
          title: "Access Restricted",
          description: `You can only access the ${userGender} division that you registered for.`,
          variant: "destructive",
        });
        navigate(`/tournament/${userGender}`);
      }
    }
  }, [userIsAdmin, userGender]);

  const loadTournamentSettings = async () => {
    try {
      // Use fixed document ID
      const settingsRef = doc(db, 'tournamentSettings', 'default_settings');
      const snapshot = await getDoc(settingsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        console.log('Index.tsx loaded settings:', data);
        console.log('Index.tsx city:', data.tournament_city);
        setTournamentSettings(data);
      } else {
        // Default settings if none exist
        setTournamentSettings({
          tournament_date: new Date().toISOString().split('T')[0],
          tournament_city: 'Da Nang',
          max_players_per_gender: 8,
          registration_cutoff_days: 3,
        });
      }
    } catch (error) {
      console.error('Error loading tournament settings:', error);
      // Don't block loading on settings - continue even if settings fail
    }
  };

  const initializeUserState = async () => {
    try {
      setIsLoadingUserData(true);
      const user = await getCurrentUser();
      const adminStatus = await checkIsAdmin();
      
      setCurrentUser(user);
      setUserIsAdmin(adminStatus);
      
      // If user is admin, they can access all divisions
      if (adminStatus) {
        setUserGender(null); // null means admin can access all
        setIsLoadingUserData(false);
        return;
      }
      
      // For regular users, get their tournament registration data to determine gender
      const playerData = await getCurrentUserTournamentData();
      if (playerData) {
        const playerGender = playerData.gender as Gender;
        setUserGender(playerGender);
        // Set the initial gender view to match user's registration
        setGender(playerGender);
      } else {
        // Check if user has local registration data as fallback
        const localEmail = localStorage.getItem('tournament_registered_email');
        const localName = localStorage.getItem('tournament_registered_name');
        
        if (localEmail && localName) {
          // Check if user exists in the database
          try {
            const playersRef = collection(db, 'players');
            const q = query(playersRef, where('email', '==', localEmail), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
              const player = snapshot.docs[0].data() as any;
              setUserGender(player.gender as Gender);
              setGender(player.gender as Gender);
            } else {
              // If user is not in the database despite local registration, redirect to landing
              navigate('/');
              return;
            }
          } catch (error) {
            console.error('Error checking local registration:', error);
            navigate('/');
            return;
          }
        } else {
          // If no tournament data found, redirect to landing
          navigate('/');
          return;
        }
      }
    } catch (error) {
      console.error('Error initializing user state:', error);
      navigate('/');
    } finally {
      setIsLoadingUserData(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Use unified signOut for all users
      await signOut();
      
      // Clear registration data
      localStorage.removeItem('tournament_registered_email');
      localStorage.removeItem('tournament_registered_name');
      
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
      navigate('/');
    }
  };

  // Reset currentMatchIndex when gender changes (admin only)
  const handleGenderChange = (newGender: Gender) => {
    // Only allow gender switching for admins
    if (!userIsAdmin) {
      return;
    }
    
    setGender(newGender);
    setCurrentMatchIndex(0);
    setScore1('');
    setScore2('');
    setShowFinalMatch(false);
  };

  const handleScoreSubmit = async () => {
    console.log('🏐 [SUBMIT] Score submit clicked');
    console.log('📊 [SUBMIT] Current scores:', { score1, score2 });
    
    // VALIDATION: Check if scores are entered
    if (!score1 || !score2) {
      console.error('❌ [SUBMIT] Empty scores - showing validation error');
      toast({
        title: "Invalid Scores",
        description: "Please enter both team scores before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    const scoreValue1 = parseInt(score1, 10);
    const scoreValue2 = parseInt(score2, 10);
    
    // VALIDATION: Ensure scores are valid numbers
    if (isNaN(scoreValue1) || isNaN(scoreValue2)) {
      console.error('❌ [SUBMIT] Invalid score format');
      toast({
        title: "Invalid Scores",
        description: "Scores must be valid numbers.",
        variant: "destructive",
      });
      return;
    }
    
    if (scoreValue1 < 0 || scoreValue2 < 0) {
      console.error('❌ [SUBMIT] Negative scores not allowed');
      toast({
        title: "Invalid Scores",
        description: "Scores cannot be negative.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('✅ [SUBMIT] Scores validated:', scoreValue1, scoreValue2);
    
    try {
      console.log('🚀 [SUBMIT] Calling updateMatchScore...');
      await updateMatchScore(currentMatchIndex, scoreValue1, scoreValue2, gender);
      console.log('✅ [SUBMIT] Score update completed');

      setSubmitFeedbackMatchIndex(currentMatchIndex);
      setTimeout(() => setSubmitFeedbackMatchIndex(null), 2000);

      // Clear the score inputs - the match data will update via realtime subscriptions
      setScore1('');
      setScore2('');
      console.log('🧹 [SUBMIT] Score inputs cleared');

      // Auto-advance to next unfinished match after 3 seconds
      setTimeout(async () => {
        await loadMatchesData(); // Reload fresh match data
        
        setTimeout(() => {
          const currentMatches = gender === 'female' ? resolvedFemaleMatches : resolvedMaleMatches;
          const nextUnfinishedIndex = currentMatches.findIndex(
            (m, idx) => idx > currentMatchIndex && !m.isSubmitted
          );
          
          if (nextUnfinishedIndex !== -1) {
            setCurrentMatchIndex(nextUnfinishedIndex);
            localStorage.setItem(`lastMatchIndex_${gender}`, nextUnfinishedIndex.toString());
            console.log('⏭️ [SUBMIT] Auto-advanced to match', nextUnfinishedIndex);
          } else {
            // Wrap around to first unfinished match
            const firstUnfinishedIndex = currentMatches.findIndex(m => !m.isSubmitted);
            if (firstUnfinishedIndex !== -1) {
              setCurrentMatchIndex(firstUnfinishedIndex);
              localStorage.setItem(`lastMatchIndex_${gender}`, firstUnfinishedIndex.toString());
              console.log('⏭️ [SUBMIT] Wrapped to first unfinished match', firstUnfinishedIndex);
            }
          }
        }, 500); // Wait for data to update
      }, 3000);
    } catch (error) {
      console.error('❌ [SUBMIT] Score submission failed:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit scores. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResetScores = async () => {
    console.log('🔄 [SCORE RESET] User clicked reset scores button, showing modal');
    setShowScoreResetModal(true);
  };

  const handleConfirmScoreReset = async () => {
    console.log('🔄 [SCORE RESET] User confirmed score reset via modal');
    setIsResettingScores(true);
    
    try {
      console.log('🔄 [SCORE RESET] Starting score reset...');
      await resetScores();
      console.log('✅ [SCORE RESET] Scores reset completed');
      
      setCurrentMatchIndex(0);
      setScore1('');
      setScore2('');
      setShowScoreResetModal(false);
      setIsResettingScores(false);
    } catch (error) {
      console.error('❌ [SCORE RESET] Score reset failed:', error);
      setIsResettingScores(false);
      toast({
        title: "Score Reset Failed",
        description: "Failed to reset scores. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloseScoreResetModal = () => {
    if (!isResettingScores) {
      setShowScoreResetModal(false);
    }
  };

  const handleFullReset = async () => {
    console.log('🔄 [FULL RESET] User clicked reset button, showing modal');
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    console.log('🔄 [FULL RESET] User confirmed reset via modal');
    setIsResetting(true);
    
    try {
      console.log('🔄 [FULL RESET] Starting reset process...');
      await resetAllData();
      console.log('✅ [FULL RESET] Reset completed, waiting 3 seconds for Firebase to stabilize...');
      
      // Wait 3 seconds to allow Firebase to fully clear and reinitialize data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('🔄 [FULL RESET] Reloading tournament data...');
      
      // Just call loadTournamentData - it already loads players, matches, and final match
      // and properly manages the isLoading state
      await loadTournamentData();
      
      console.log('✅ [FULL RESET] Data reloaded successfully');
      
      // Reset local state
      setCurrentMatchIndex(0);
      setScore1('');
      setScore2('');
      setShowFinalMatch(false);
      setShowResetModal(false);
      setIsResetting(false);
    } catch (error) {
      console.error('❌ [FULL RESET] Error:', error);
      // Just close the modal and reset state - no error message
      setShowResetModal(false);
      setIsResetting(false);
      
      // Try to reload data anyway
      try {
        await loadTournamentData();
      } catch (e) {
        console.error('❌ [FULL RESET] Data reload also failed:', e);
      }
    }
  };

  const handleCloseResetModal = () => {
    if (!isResetting) {
      setShowResetModal(false);
    }
  };

  const handleEditMatch = (match: any, matchIndex: number) => {
    setEditingMatchId(match.id);
    setCurrentMatchIndex(matchIndex);
    setScore1(match.score1.toString());
    setScore2(match.score2.toString());
  }

  const handleSaveMatchEdit = async () => {
    if (!editingMatchId) return;
    
    const scoreValue1 = parseInt(score1, 10) || 0;
    const scoreValue2 = parseInt(score2, 10) || 0;
    
    try {
      await updateMatchScore(currentMatchIndex, scoreValue1, scoreValue2, gender, true);
      await loadTournamentData();
      setEditingMatchId(null);
      setScore1('');
      setScore2('');
      setSaveEditFeedback(true);
      setTimeout(() => setSaveEditFeedback(false), 2000);
    } catch (error) {
      console.error('Error updating match score:', error);
      toast({
        title: "Error",
        description: "Failed to update match score",
        variant: "destructive",
      });
    }
  }

  const handleCancelEdit = () => {
    setEditingMatchId(null);
    setScore1('');
    setScore2('');
  }

  const handleFinalMatchSubmit = async () => {
    console.log('🏆 [FINAL SUBMIT] Button clicked!');
    console.log('🏆 [FINAL SUBMIT] Current scores:', finalMatchScores);
    console.log('🏆 [FINAL SUBMIT] Current submitted state:', finalMatchSubmitted);
    
    // Validate scores before submitting
    const hasValidScores = finalMatchScores.team1.some(s => s !== null && s !== 0) || finalMatchScores.team2.some(s => s !== null && s !== 0);
    if (!hasValidScores) {
      console.error('❌ [FINAL SUBMIT] No scores entered!');
      toast({
        title: "Invalid Scores",
        description: "Please enter at least one set score before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('🏆 [FINAL SUBMIT] Calling updateFinalMatchData...');
      // Use the updated final match logic based on tournament type
      await updateFinalMatchData(finalMatchScores);
      console.log('🏆 [FINAL SUBMIT] Success! Setting submitted state...');
      setFinalSubmitFeedback(true);
      setTimeout(() => setFinalSubmitFeedback(false), 2000);
      
      // Manually set submitted state immediately
      // Don't wait for real-time update
    } catch (error) {
      console.error('❌ [FINAL SUBMIT] Error submitting final match:', error);
      toast({
        title: "Error",
        description: "Failed to submit final match",
        variant: "destructive",
      });
    }
  }

  const handleEditFinalMatch = () => {
    setIsEditingFinalMatch(true)
  }

  const handleFinalMatchEditSubmit = async () => {
    setIsEditingFinalMatch(false);
    try {
      await updateFinalMatchData(finalMatchScores);
      setFinalEditFeedback(true);
      setTimeout(() => setFinalEditFeedback(false), 2000);
    } catch (error) {
      console.error('Error updating final match:', error);
      toast({
        title: "Error",
        description: "Failed to update final match",
        variant: "destructive",
      });
    }
  }

  const handleResetFinalMatch = async () => {
    setShowResetFinalMatchModal(false);
    try {
      const finalMatchesRef = collection(db, 'finalMatches');
      const snapshot = await getDocs(finalMatchesRef);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      
      const resetScores: FinalMatchScores = { 
        team1: [null, null, null], 
        team2: [null, null, null] 
      };
      setFinalMatchScores(resetScores);
      setIsEditingFinalMatch(false);
      await loadTournamentData();
    } catch (error) {
      console.error('Error resetting final match:', error);
      alert('Failed to reset final match. Please try again.');
    }
  }

  const handlePreviousMatch = () => {
    if (currentMatchIndex > 0) {
      const newIndex = currentMatchIndex - 1;
      setCurrentMatchIndex(newIndex);
      localStorage.setItem(`lastMatchIndex_${gender}`, newIndex.toString());
      setEditingMatchId(null);
      setScore1('');
      setScore2('');
    }
  };

  const handleNextMatch = () => {
    if (currentMatchIndex < matches.length - 1) {
      const newIndex = currentMatchIndex + 1;
      setCurrentMatchIndex(newIndex);
      localStorage.setItem(`lastMatchIndex_${gender}`, newIndex.toString());
      setEditingMatchId(null);
      setScore1('');
      setScore2('');
    }
  };

  // Force bypass loading state after timeout
  const [forceBypass, setForceBypass] = useState(false);
  
  useEffect(() => {
    // Auto-clear loading state after 10 seconds to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading || isLoadingUserData) {
        console.log('⏰ [FORCE BYPASS] Loading timeout reached, enabling bypass option');
        setForceBypass(true);
      }
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, [isLoading, isLoadingUserData]);

  if ((isLoading || isLoadingUserData) && !forceBypass) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in space-y-4">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            {isLoadingUserData ? 'Loading Your Access...' : 'Loading Tournament Data...'}
          </h2>
          <p className="text-foreground/70 font-medium">Setting up the beach volleyball tracker</p>
          {(isLoading && !isLoadingUserData) && (
            <div className="space-y-3 max-w-sm mx-auto mt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-foreground/60 mb-4">
                <div className="w-2 h-2 bg-ocean rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-ocean rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-ocean rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <Button 
                onClick={loadTournamentData} 
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
              >
                🔄 Continue to Tournament
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tournament Switch Off Mode: players see the finished page (admins keep full access)
  if (tournamentFinished && !userIsAdmin) {
    return <TournamentFinished />;
  }

  // Gate: Show waiting screen for approved non-admin users until draw is complete
  // CRITICAL: Also gate if draw says complete but matches are empty (invalid state)
  if (!userIsAdmin && (!drawCompleted || !matches || matches.length === 0)) {
    return <WaitingForDraw onDrawComplete={() => setDrawCompleted(true)} />;
  }

  // Show loading state while waiting for data
  if (!matches || matches.length === 0) {
    console.log('⚠️ [LOADING] No matches found yet, showing diagnostic state.');
    console.log('📊 [DIAGNOSTIC] Players:', femalePlayers.length, 'female,', malePlayers.length, 'male');
    console.log('📊 [DIAGNOSTIC] Matches:', femaleMatches.length, 'female,', maleMatches.length, 'male');
    
    const hasPlayers = femalePlayers.length === 8 && malePlayers.length === 8;
    const needsDraw = hasPlayers && femaleMatches.length === 0 && maleMatches.length === 0;
    
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            {needsDraw ? 'Waiting for Tournament Draw' : 'Loading Tournament Data...'}
          </h2>
          
          {/* Diagnostic Info */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-sand-dark/20 max-w-sm mx-auto">
            <div className="text-sm text-left space-y-2">
              <div className="flex justify-between">
                <span>Female Players:</span>
                <span className={femalePlayers.length === 8 ? 'text-green-600 font-semibold' : 'text-orange-500'}>
                  {femalePlayers.length}/8
                </span>
              </div>
              <div className="flex justify-between">
                <span>Male Players:</span>
                <span className={malePlayers.length === 8 ? 'text-green-600 font-semibold' : 'text-orange-500'}>
                  {malePlayers.length}/8
                </span>
              </div>
              <div className="flex justify-between">
                <span>Female Matches:</span>
                <span className={femaleMatches.length === 14 ? 'text-green-600 font-semibold' : 'text-orange-500'}>
                  {femaleMatches.length}/14
                </span>
              </div>
              <div className="flex justify-between">
                <span>Male Matches:</span>
                <span className={maleMatches.length === 14 ? 'text-green-600 font-semibold' : 'text-orange-500'}>
                  {maleMatches.length}/14
                </span>
              </div>
            </div>
          </div>
          
          <p className="text-foreground/70 font-medium mb-6">
            {needsDraw 
              ? '8 players ready. Admin needs to run the draw to generate matches.' 
              : 'Setting up the beach volleyball tracker'}
          </p>
          
          <div className="space-y-3 max-w-sm mx-auto">
            {needsDraw && isAdmin && (
              <Button 
                onClick={() => navigate('/draw')} 
                className="w-full touch-target bg-sunset hover:bg-sunset-dark text-white font-semibold py-3 transition-all duration-300"
              >
                🎯 Go to Draw Page
              </Button>
            )}
            <Button 
              onClick={loadTournamentData} 
              className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
            >
              🔄 Reload Data
            </Button>
            {isAdmin && (
              <Button 
                onClick={handleFullReset} 
                variant="destructive"
                className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
              >
                🔄 Reset & Initialize
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Type assertion to ResolvedMatch since resolveMatchPlayers returns ResolvedMatch[]
  const typedMatches = matches as ResolvedMatch[];
  const currentMatch = typedMatches[currentMatchIndex];

  if (!currentMatch || matches.length === 0) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold mb-3 bg-sunset-gradient bg-clip-text text-transparent">No matches available</h2>
          <p className="text-foreground/70 font-medium mb-6">Matches are being initialized. Please wait a moment and refresh.</p>
          <div className="space-y-3 max-w-sm mx-auto">
            <Button 
              onClick={retryMatchInitialization} 
              className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
            >
              🔄 Retry Match Initialization
            </Button>
            {isAdmin && (
              <Button 
                onClick={handleResetScores} 
                variant="destructive"
                className="w-full touch-target bg-coral hover:bg-coral-dark text-white transition-all duration-300"
              >
                Reset and Reinitialize Data
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <header>
          <div className="flex flex-col items-center gap-6">
            {/* User Status Header */}
            <div className="w-full bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-sand-dark/20 shadow-sand">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {userIsAdmin ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Crown className="w-4 h-4 text-sunset" />
                      <span className="font-semibold text-sunset">Admin Access</span>
                    </div>
                  ) : currentUser ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-ocean" />
                      <span className="font-medium text-ocean truncate max-w-[120px]">
                        {currentUser.email || localStorage.getItem('tournament_registered_name') || 'Player'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-palm" />
                      <span className="font-medium text-palm">
                        {localStorage.getItem('tournament_registered_name') || 'Registered'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="bg-white/80 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-center pt-4 relative w-full">
              <div className="relative">
                <div className="w-full max-w-2xl mx-auto text-center px-4 mb-4">
                  <MainTitle />
                </div>
                <div className="w-16 h-1 bg-sunset mx-auto rounded-full"></div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-sm">
              {/* Show gender division access info for regular users */}
              {!userIsAdmin && userGender && (
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-sand-dark/20 shadow-sand">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground/70 mb-1">🏐 Your Division Access</p>
                    <p className="text-xs text-foreground/60">
                      You can only view matches for the {userGender} division that you registered for.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Admin can see all divisions */}
              {userIsAdmin && (
                <>
                  <Button 
                    variant={gender === 'female' ? "default" : "outline"} 
                    onClick={() => handleGenderChange('female')}
                    className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                      gender === 'female' 
                        ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach animate-pulse-glow' 
                        : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
                    }`}
                  >
                    👩 Female Division
                  </Button>
                  <Button 
                    variant={gender === 'male' ? "default" : "outline"}
                    onClick={() => handleGenderChange('male')}
                    className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                      gender === 'male' 
                        ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach animate-pulse-glow' 
                        : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
                    }`}
                  >
                    👨 Male Division  
                  </Button>
                </>
              )}
              
              {/* Regular user sees only their division - show as info card */}
              {!userIsAdmin && userGender && (
                <div className={`w-full rounded-xl p-4 text-center transition-all duration-300 ${
                  userGender === 'female'
                    ? 'bg-sunset text-white shadow-beach'
                    : 'bg-ocean text-white shadow-beach'
                }`}>
                  <div className="text-xl font-bold mb-1">
                    {userGender === 'female' ? '👩 Female Division' : '👨 Male Division'}
                  </div>
                  <div className="text-sm opacity-90">
                    Your registered division
                  </div>
                </div>
              )}
              
              {/* Championship Final - available to all */}
              <Button
                variant={showFinalMatch ? "default" : "outline"}
                onClick={() => setShowFinalMatch(true)}
                className={`w-full touch-target font-semibold text-lg py-4 transition-all duration-300 ${
                  showFinalMatch
                    ? 'bg-beach-gradient text-white shadow-beach animate-bounce-gentle'
                    : 'bg-white/70 hover:bg-beach-gradient hover:text-white border-primary/20 text-primary shadow-sand'
                }`}
                disabled={showFinalMatch}
              >
                👑 Championship Final
              </Button>

              {/* Back to Admin button for admin users */}
              {userIsAdmin && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/control')}
                  className="w-full touch-target font-semibold text-lg py-4 transition-all duration-300 bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand"
                >
                  ← Back to Admin
                </Button>
              )}

              {/* Back to Division button for regular users when viewing Championship Final */}
              {!userIsAdmin && userGender && showFinalMatch && (
                <Button 
                  variant="outline"
                  onClick={() => setShowFinalMatch(false)}
                  className="w-full touch-target font-semibold text-lg py-4 transition-all duration-300 bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand"
                >
                  ← Back to {userGender === 'female' ? 'Female' : 'Male'} Division
                </Button>
              )}
            </div>
            
          </div>
        </header>

        {showUnregistration && (
          <PlayerUnregistration 
            onClose={() => setShowUnregistration(false)}
            onSuccess={() => {}}
          />
        )}

        <ResetConfirmationModal
          isOpen={showResetModal}
          onClose={handleCloseResetModal}
          onConfirm={handleConfirmReset}
          isResetting={isResetting}
        />

        <ScoreResetConfirmationModal
          isOpen={showScoreResetModal}
          onClose={handleCloseScoreResetModal}
          onConfirm={handleConfirmScoreReset}
          isResetting={isResettingScores}
        />

        <main>
            {showFinalMatch ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="bg-beach-gradient text-white rounded-2xl p-6 shadow-beach">
                    <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                      <Crown className="w-6 h-6" />
                      Championship Final
                      <Crown className="w-6 h-6" />
                    </h2>
                    {malePlayers.length < 2 || femalePlayers.length < 2 ? (
                      <p className="text-sm mt-2 opacity-90">
                        Waiting for at least 2 male and 2 female players...
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {malePlayers.length < 2 || femalePlayers.length < 2 ? (
                    <Card className="border-2 border-ocean/20 bg-white/80 backdrop-blur-sm shadow-beach">
                      <CardContent className="p-8 text-center">
                        <p className="text-lg text-foreground/60">
                          Championship Final will be available once there are at least 2 male and 2 female players with rankings.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                  <Card className="border-2 border-ocean/20 bg-white/80 backdrop-blur-sm shadow-beach">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-ocean">
                        🏐 Team 1
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-xl text-ocean-dark font-semibold">
                          {malePlayers[0]?.name} & {femalePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team1-set${setIndex + 1}`} className="text-base font-medium text-center block text-ocean">
                              Set {setIndex + 1}
                            </Label>
                            <Input
                              id={`team1-set${setIndex + 1}`}
                              value={finalMatchScores.team1[setIndex] !== null ? finalMatchScores.team1[setIndex] : ''}
                              onChange={(e) => {
                                const newScores = [...finalMatchScores.team1];
                                newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setFinalMatchScores({
                                  ...finalMatchScores,
                                  team1: newScores as [number | null, number | null, number | null]
                                });
                              }}
                              type="number"
                              className="text-center font-bold text-xl touch-target border-ocean/30 focus:border-ocean bg-white/70"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-center">
                    <div className="bg-sunset-gradient text-white px-8 py-3 rounded-full font-bold text-xl shadow-beach animate-pulse-glow">
                      ⚡ VS ⚡
                    </div>
                  </div>

                  <Card className="border-2 border-sunset/20 bg-white/80 backdrop-blur-sm shadow-beach">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-center text-lg font-bold text-sunset">
                        🏐 Team 2
                      </CardTitle>
                      <div className="text-center">
                        <p className="text-xl text-sunset-dark font-semibold">
                          {femalePlayers[0]?.name} & {malePlayers[1]?.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((setIndex) => (
                          <div key={setIndex} className="space-y-2">
                            <Label htmlFor={`team2-set${setIndex + 1}`} className="text-base font-medium text-center block text-sunset">
                              Set {setIndex + 1}
                            </Label>
                            <Input
                              id={`team2-set${setIndex + 1}`}
                              value={finalMatchScores.team2[setIndex] !== null ? finalMatchScores.team2[setIndex] : ''}
                              onChange={(e) => {
                                const newScores = [...finalMatchScores.team2];
                                newScores[setIndex] = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setFinalMatchScores({
                                  ...finalMatchScores,
                                  team2: newScores as [number | null, number | null, number | null]
                                });
                              }}
                              type="number"
                              className="text-center font-bold text-xl touch-target border-sunset/30 focus:border-sunset bg-white/70"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={finalMatchSubmitted && !isEditingFinalMatch}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  </>
                  )}
                </div>

                {!finalMatchSubmitted ? (
                  <Button 
                    onClick={handleFinalMatchSubmit} 
                    className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-4 text-lg shadow-beach transition-all duration-300"
                  >
                    {finalSubmitFeedback ? "✓ Submitted!" : "🚀 Submit Championship Match"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Card className="border-2 border-palm/30 bg-palm-light/20 backdrop-blur-sm shadow-beach">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <Check className="text-palm w-6 h-6" />
                            <h3 className="text-lg font-bold text-palm-dark">🎉 Match Complete! 🎉</h3>
                            <Check className="text-palm w-6 h-6" />
                          </div>
                          <div className="space-y-2 text-sm">
                            <p className="font-semibold text-palm-dark">
                              Team 1: {finalMatchScores.team1.map(s => s ?? 0).join(' - ')}
                            </p>
                            <p className="font-semibold text-palm-dark">
                              Team 2: {finalMatchScores.team2.map(s => s ?? 0).join(' - ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {finalMatchWinner && (
                      <Card className="border-0 bg-beach-gradient shadow-2xl">
                        <CardContent className="p-6">
                          <div className="text-center space-y-6">
                            {/* Champions Section - Main Highlight */}
                            <div className="bg-white/15 backdrop-blur-md text-white rounded-2xl p-6 space-y-4 shadow-xl border border-white/20">
                              <div className="mb-4">
                                <h3 className="text-3xl md:text-4xl font-extrabold flex items-center justify-center gap-3">
                                  <Crown className="w-10 h-10 md:w-12 md:h-12" />
                                  Champions
                                  <Crown className="w-10 h-10 md:w-12 md:h-12" />
                                </h3>
                                {finalMatchWinner.completedAt && (
                                  <p className="text-sm font-bold text-white/70 mt-2">
                                    {new Date(finalMatchWinner.completedAt).toLocaleDateString('en-GB', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric' 
                                    })}
                                    {tournamentSettings?.tournament_city && ` · ${tournamentSettings.tournament_city}`}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-4">
                                {/* Calculate King & Queen based on winning team */}
                                {finalMatchWinner.winningTeam === 1 ? (
                                  <>
                                    <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-5 border border-yellow-400/30 shadow-lg">
                                      <p className="text-lg font-bold mb-1 opacity-95 flex items-center justify-center gap-2">
                                        <span className="text-2xl">👑</span> King <span className="text-2xl">👑</span>
                                      </p>
                                      <p className="text-2xl font-extrabold tracking-wide text-center">{malePlayers[0]?.name || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-5 border border-yellow-400/30 shadow-lg">
                                      <p className="text-lg font-bold mb-1 opacity-95 flex items-center justify-center gap-2">
                                        <span className="text-2xl">👑</span> Queen <span className="text-2xl">👑</span>
                                      </p>
                                      <p className="text-2xl font-extrabold tracking-wide text-center">{femalePlayers[1]?.name || 'Unknown'}</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-5 border border-yellow-400/30 shadow-lg">
                                      <p className="text-lg font-bold mb-1 opacity-95 flex items-center justify-center gap-2">
                                        <span className="text-2xl">👑</span> King <span className="text-2xl">👑</span>
                                      </p>
                                      <p className="text-2xl font-extrabold tracking-wide text-center">{malePlayers[1]?.name || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-5 border border-yellow-400/30 shadow-lg">
                                      <p className="text-lg font-bold mb-1 opacity-95 flex items-center justify-center gap-2">
                                        <span className="text-2xl">👑</span> Queen <span className="text-2xl">👑</span>
                                      </p>
                                      <p className="text-2xl font-extrabold tracking-wide text-center">{femalePlayers[0]?.name || 'Unknown'}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Runners-up Section - Secondary */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 space-y-3 border border-white/15">
                              <h3 className="text-xl font-bold text-white mb-3 text-center">🥈 Runners-up</h3>
                              <div className="space-y-3">
                                {/* Calculate Prince & Princess based on losing team */}
                                {finalMatchWinner.winningTeam === 1 ? (
                                  <>
                                    <div className="bg-white/10 rounded-lg p-3 border border-white/15">
                                      <p className="text-sm font-bold text-white/80 mb-1 flex items-center justify-center gap-1">
                                        <span className="text-lg">🤴</span> Prince <span className="text-lg">🤴</span>
                                      </p>
                                      <p className="text-lg font-bold text-white text-center">{malePlayers[1]?.name || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 border border-white/15">
                                      <p className="text-sm font-bold text-white/80 mb-1 flex items-center justify-center gap-1">
                                        <span className="text-lg">👸</span> Princess <span className="text-lg">👸</span>
                                      </p>
                                      <p className="text-lg font-bold text-white text-center">{femalePlayers[0]?.name || 'Unknown'}</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="bg-white/10 rounded-lg p-3 border border-white/15">
                                      <p className="text-sm font-bold text-white/80 mb-1 flex items-center justify-center gap-1">
                                        <span className="text-lg">🤴</span> Prince <span className="text-lg">🤴</span>
                                      </p>
                                      <p className="text-lg font-bold text-white text-center">{malePlayers[0]?.name || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 border border-white/15">
                                      <p className="text-sm font-bold text-white/80 mb-1 flex items-center justify-center gap-1">
                                        <span className="text-lg">👸</span> Princess <span className="text-lg">👸</span>
                                      </p>
                                      <p className="text-lg font-bold text-white text-center">{femalePlayers[1]?.name || 'Unknown'}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {userIsAdmin && (
                      <div className="flex flex-col gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleEditFinalMatch} 
                          className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Match
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => setShowResetFinalMatchModal(true)} 
                          className="w-full touch-target bg-coral hover:bg-coral-dark transition-all duration-300"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Reset Match
                        </Button>
                        {isEditingFinalMatch && (
                          <Button 
                            onClick={handleFinalMatchEditSubmit} 
                            className="w-full touch-target bg-palm hover:bg-palm-dark text-white transition-all duration-300"
                          >
                            {finalEditFeedback ? "✓ Saved!" : "💾 Save Changes"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
                  <CardHeader>
                    <div className="flex flex-col items-center gap-3">
                      <CardTitle className="text-xl font-bold text-center bg-ocean-gradient bg-clip-text text-transparent">
                        🏐 {gender.charAt(0).toUpperCase() + gender.slice(1)} Match {currentMatchIndex + 1} of {matches.length}
                      </CardTitle>
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousMatch}
                          disabled={currentMatchIndex === 0}
                          className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm font-bold text-foreground/70 px-2">
                          {currentMatchIndex + 1}/{matches.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextMatch}
                          disabled={currentMatchIndex === matches.length - 1}
                          className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Card className="border-2 border-ocean/20 bg-ocean/5 shadow-sand">
                      <CardContent className="p-4">
                        <div className="text-center space-y-3">
                          <div className="bg-ocean text-white rounded-xl py-4 px-4 shadow-beach">
                            <p className="text-xl font-bold">
                              {currentMatch.teamA[0].name} & {currentMatch.teamA[1].name}
                            </p>
                          </div>
                          {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                            <Input
                              value={editingMatchId === currentMatch.id ? score1 : (currentMatch.isSubmitted ? currentMatch.score1 : score1)}
                              onChange={(e) => setScore1(e.target.value)}
                              type="number"
                              className="w-24 mx-auto text-center text-2xl font-bold touch-target border-ocean/30 focus:border-ocean bg-white/80"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
                              placeholder="0"
                            />
                          ) : (
                            <div className="bg-ocean text-white rounded-xl py-4 shadow-beach">
                              <p className="text-4xl font-bold">{currentMatch.score1}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center justify-center">
                      <div className="bg-sunset-gradient text-white px-8 py-3 rounded-full font-bold text-xl shadow-beach animate-pulse-glow">
                        ⚡ VS ⚡
                      </div>
                    </div>

                    <Card className="border-2 border-sunset/20 bg-sunset/5 shadow-sand">
                      <CardContent className="p-4">
                        <div className="text-center space-y-3">
                          <div className="bg-sunset text-white rounded-xl py-4 px-4 shadow-beach">
                            <p className="text-xl font-bold">
                              {currentMatch.teamB[0].name} & {currentMatch.teamB[1].name}
                            </p>
                          </div>
                          {!currentMatch.isSubmitted || editingMatchId === currentMatch.id ? (
                            <Input
                              value={editingMatchId === currentMatch.id ? score2 : (currentMatch.isSubmitted ? currentMatch.score2 : score2)}
                              onChange={(e) => setScore2(e.target.value)}
                              type="number"
                              className="w-24 mx-auto text-center text-2xl font-bold touch-target border-sunset/30 focus:border-sunset bg-white/80"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={currentMatch.isSubmitted && editingMatchId !== currentMatch.id}
                              placeholder="0"
                            />
                          ) : (
                            <div className="bg-sunset text-white rounded-xl py-4 shadow-beach">
                              <p className="text-4xl font-bold">{currentMatch.score2}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {!currentMatch.isSubmitted && editingMatchId !== currentMatch.id ? (
                      <Button 
                        onClick={handleScoreSubmit} 
                        className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-4 text-lg shadow-beach transition-all duration-300"
                      >
                        {submitFeedbackMatchIndex === currentMatchIndex ? "✓ Submitted!" : "🚀 Submit Score"}
                      </Button>
                    ) : editingMatchId === currentMatch.id ? (
                      <div className="flex gap-3">
                        <Button 
                          onClick={handleSaveMatchEdit} 
                          className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white transition-all duration-300"
                        >
                          {saveEditFeedback ? "✓ Saved!" : "💾 Save Score"}
                        </Button>
                        <Button 
                          onClick={handleCancelEdit} 
                          variant="outline" 
                          className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                        >
                          ❌ Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2 bg-palm/10 p-4 rounded-xl border border-palm/20">
                          <Check className="text-palm w-6 h-6" />
                          <p className="font-bold text-palm-dark">
                            🎯 Final Score: {currentMatch.score1} - {currentMatch.score2}
                          </p>
                        </div>
                        {userIsAdmin && (
                          <Button 
                            onClick={() => handleEditMatch(currentMatch, currentMatchIndex)}
                            variant="outline"
                            className="w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean transition-all duration-300"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            ✏️ Edit Score
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="mt-6 bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-center bg-sunset-gradient bg-clip-text text-transparent">
                      🏆 {gender.charAt(0).toUpperCase() + gender.slice(1)} Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {sortedPlayers.map((player, index) => {
                        const tiebreaker = getTiebreakerForPlayer(index);
                        
                        return (
                        <div key={`${player.name}-${index}`} className={`flex flex-col gap-1 p-4 rounded-xl shadow-sand transition-all duration-300 ${
                          index === 0 ? 'bg-sunset-gradient text-white' : 
                          index === 1 ? 'bg-ocean/20 border-2 border-ocean/30' : 
                          index === 2 ? 'bg-palm/20 border-2 border-palm/30' : 
                          'bg-sand-light/50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-xl font-bold ${
                                index === 0 ? 'text-white' : 
                                index === 1 ? 'text-ocean' : 
                                index === 2 ? 'text-palm' : 
                                'text-foreground'
                              }`}>
                                #{index + 1}
                              </span>
                              <span className={`font-bold text-lg ${
                                index === 0 ? 'text-white' : 'text-foreground'
                              }`}>{player.name}</span>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                index === 0 ? 'text-white' : 'text-foreground'
                              }`}>{player.points} pts</div>
                              <div className={`text-sm ${
                                index === 0 ? 'text-white/80' : 'text-foreground/60'
                              }`}>{player.totalScores} total</div>
                            </div>
                          </div>
                          {tiebreaker && (
                            <div className={`text-xs text-center ${
                              index === 0 ? 'text-white/70' : 'text-foreground/50'
                            }`}>
                              Tiebreaker: {tiebreaker}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>

        {/* Cancel Registration button for non-admin users */}
        {!userIsAdmin && (
          <div className="flex justify-center mt-6">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowUnregistration(true)}
              className="px-4 py-2 touch-target bg-white/80 backdrop-blur-sm border-coral/20 hover:bg-coral hover:text-white transition-all duration-300"
            >
              📧 Cancel Registration
            </Button>
          </div>
        )}

      </div>
      <Toaster />

      <ResetConfirmationModal
        isOpen={showResetFinalMatchModal}
        onClose={() => setShowResetFinalMatchModal(false)}
        onConfirm={handleResetFinalMatch}
        isResetting={false}
        title="Reset Final Match?"
        description="This will clear all final match data including scores and team selections. This action cannot be undone."
        confirmText="Reset Match"
      />
    </div>
  );
}
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db } from "@/config/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, writeBatch, orderBy, limit, updateDoc, addDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Calendar, Users, Trash2, Settings, Crown, Mail, CheckCircle, FileText, Clock, Shuffle, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resetPlayersToPlaceholders } from "@/utils/placeholderUtils";
import { initializePlayers } from "@/utils/playerInitUtils";
import { initializeMatches } from "@/utils/matchInitUtils";
import { exportMatchupsToPDF, FinalMatchInfo } from "@/utils/pdfExport";
import { removePendingPlayer, cleanupOrphanPlaceholderDocs } from "@/utils/placeholderUtils";
import { Player, ResolvedMatch } from "@/types";

interface ConfirmedPlayer {
  id: string;
  name: string;
  email: string;
  gender: string;
  registered_at: string;
  status?: string;
  position?: number;
}

interface PendingPlayer {
  id: string;
  name: string;
  email: string;
  gender: string;
  registered_at: string;
  status?: string;
  position?: number;
  is_reserve?: boolean;
}

interface TournamentSettings {
  id: string;
  tournament_date: string;
  max_players_per_gender: number;
  registration_cutoff_days: number;
}

interface AdminPanelProps {
  onClose: () => void;
  players?: (Player & { gender: string })[];
  femaleMatches?: ResolvedMatch[];
  maleMatches?: ResolvedMatch[];
  tournamentDate?: string;
  tournamentCity?: string;
}

export function AdminPanel({ onClose, players, femaleMatches, maleMatches, tournamentDate, tournamentCity }: AdminPanelProps) {
  const navigate = useNavigate();
  const [confirmedPlayers, setConfirmedPlayers] = useState<ConfirmedPlayer[]>([]);
  const [pendingPlayers, setPendingPlayers] = useState<PendingPlayer[]>([]);
  const [settings, setSettings] = useState<TournamentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Inline confirmation states
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingInit, setConfirmingInit] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      // Load confirmed/approved players
      const playersRef = collection(db, 'players');
      const approvedQuery = query(
        playersRef, 
        where('status', '==', 'approved')
      );
      const approvedSnapshot = await getDocs(approvedQuery);
      const approved = approvedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConfirmedPlayer));
      setConfirmedPlayers(approved || []);

      // Load pending players
      const pendingQuery = query(
        playersRef,
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pending = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingPlayer));
      
      // Sort by registration date (oldest first)
      pending.sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
      setPendingPlayers(pending || []);

      // Load tournament settings
      const settingsRef = collection(db, 'tournamentSettings');
      const settingsSnap = await getDocs(settingsRef);
      const settingsData = settingsSnap.empty ? null : settingsSnap.docs[0].data();

      setSettings(settingsData as any);

      // Auto-clean orphan placeholder docs (phantom "Male Player 9" entries)
      const removed = await cleanupOrphanPlaceholderDocs();
      if (removed > 0) {
        console.log(`🧹 [ADMIN] Cleaned ${removed} orphan placeholder docs`);
        // Reload lists after cleanup
        await loadAdminData();
        return;
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    try {
      const playerRef = doc(db, 'players', playerId);
      const batch = writeBatch(db);
      batch.delete(playerRef);
      await batch.commit();

      toast({
        title: "Player Removed",
        description: `${playerName} has been removed from the tournament`,
      });


      await loadAdminData();
    } catch (error) {
      console.error('Error removing player:', error);
      toast({
        title: "Removal Failed",
        description: "Failed to remove player",
        variant: "destructive",
      });
    }
  };

  const handleApprovePlayer = async (player: PendingPlayer) => {
    try {
      const maxPlayers = settings?.max_players_per_gender || 8;
      const approvedInGender = confirmedPlayers.filter(p => p.gender === player.gender).length;

      // Guard: reserve players can only be approved if there's a free slot
      if (player.is_reserve && approvedInGender >= maxPlayers) {
        toast({
          title: "Division Full",
          description: `The ${player.gender} division is full (${approvedInGender}/${maxPlayers}). Remove a confirmed player first to free a slot for ${player.name}.`,
          variant: "destructive",
        });
        return;
      }

      // Reserve players have no slot of their own (created via addDoc).
      // Claim a free placeholder slot doc on approval so the division keeps exactly 8 docs.
      if (player.is_reserve) {
        const playersRef = collection(db, 'players');
        const genderSnap = await getDocs(query(playersRef, where('gender', '==', player.gender)));
        // Free slot = REAL placeholder slot doc: must have a numeric position (1-8),
        // no email, not a reserve, not already approved. Orphan placeholders left by
        // reserve round-trips have no position and must NOT be claimed (they would
        // create a phantom 9th player in rankings and break the 8-per-gender invariant).
        const freeSlots = genderSnap.docs
          .filter(d => {
            const data = d.data();
            return (
              data.is_reserve !== true &&
              !data.email &&
              (data.status == null || data.status === '' || data.status === 'pending') &&
              typeof data.position === 'number'
            );
          })
          .sort((a, b) => (a.data().position || 0) - (b.data().position || 0));
        const freeSlot = freeSlots[0];

        if (freeSlot) {
          const slotData = freeSlot.data();
          const batch = writeBatch(db);
          // Move the player into the slot doc so counts stay at exactly 8
          batch.set(doc(db, 'players', freeSlot.id), {
            name: player.name.trim(),
            email: player.email.trim().toLowerCase(),
            gender: player.gender,
            position: slotData.position ?? player.position,
            status: 'approved',
            is_confirmed: true,
            is_reserve: false,
            approved_at: new Date().toISOString(),
            registered_at: player.registered_at || new Date().toISOString(),
            points: 0,
            total_scores: 0,
            matches_played: 0
          });
          // Remove the old reserve doc (it has no slot position)
          batch.delete(doc(db, 'players', player.id));
          await batch.commit();

          toast({
            title: "Player Approved",
            description: `${player.name} has been approved into slot ${slotData.position ?? ''} in the ${player.gender} division`,
          });


          await loadAdminData();
          return;
        }

        // No real slot available for this reserve - approve in place would create a
        // phantom non-slot player. Show an error instead of silently breaking counts.
        toast({
          title: "No Slot Available",
          description: `No free slot found for ${player.name}. Remove or move a confirmed ${player.gender} player first, then approve again.`,
          variant: "destructive",
        });

        return;
      }

      // Normal path: player already occupies a slot — just approve in place
      const playerRef = doc(db, 'players', player.id);
      await updateDoc(playerRef, {
        status: 'approved',
        is_confirmed: true,
        is_reserve: false,
        approved_at: new Date().toISOString()
      });

      toast({
        title: "Player Approved",
        description: `${player.name} has been approved and added to the tournament`,
      });

      // TODO: Send approval email here if email service is configured
      // await sendApprovalEmail(playerEmail, playerName);


      await loadAdminData();
    } catch (error) {
      console.error('Error approving player:', error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve player",
        variant: "destructive",
      });
    }
  };

  const handleRemovePendingPlayer = async (player: PendingPlayer) => {
    try {
      await removePendingPlayer(player);

      toast({
        title: "Registration Removed",
        description: `${player.name}'s registration has been removed. The slot is now available.`,
      });


      await loadAdminData();
    } catch (error) {
      console.error('Error removing pending player:', error);
      toast({
        title: "Removal Failed",
        description: "Failed to remove registration",
        variant: "destructive",
      });
    }
  };

  const handleUnapprovePlayer = async (playerId: string, playerName: string) => {
    try {
      const playerRef = doc(db, 'players', playerId);
      await updateDoc(playerRef, {
        status: 'pending',
        is_confirmed: false,
        approved_at: null
      });

      toast({
        title: "Player Set Back to Pending",
        description: `${playerName} has been moved back to pending registrations`,
      });


      await loadAdminData();
    } catch (error) {
      console.error('Error unapproving player:', error);
      toast({
        title: "Update Failed",
        description: "Failed to move player back to pending",
        variant: "destructive",
      });
    }
  };

  const handleMoveToReserve = async (player: ConfirmedPlayer) => {
    try {
      // Approved players without a position are reserves that were approved in place
      // (extra docs, no slot). Moving them back just reverts their status to pending
      // reserve - there is no slot to free, so no placeholder should be created.
      if (player.position == null) {
        const playerRef = doc(db, 'players', player.id);
        await updateDoc(playerRef, {
          is_confirmed: false,
          status: 'pending',
          is_reserve: true,
          approved_at: null
        });

        toast({
          title: "Moved to Reserve",
          description: `${player.name} has been moved back to reserve.`,
        });


        await loadAdminData();
        return;
      }

      const playersRef = collection(db, 'players');

      // Create a new reserve doc (no slot) with the player's info
      const reserveData = {
        name: player.name.trim(),
        email: player.email.trim().toLowerCase(),
        gender: player.gender,
        is_confirmed: false,
        status: 'pending',
        is_reserve: true,
        points: 0,
        total_scores: 0,
        registered_at: player.registered_at || new Date().toISOString()
      };
      await addDoc(playersRef, reserveData);

      // Free their old slot back to a placeholder
      const placeholderName = player.gender === 'male'
        ? `Male Player ${player.position ?? ''}`.trim()
        : `Female Player ${player.position ?? ''}`.trim();
      const playerRef = doc(db, 'players', player.id);
      await updateDoc(playerRef, {
        name: placeholderName,
        email: null,
        is_confirmed: false,
        status: null,
        approved_at: null,
        registered_at: null,
        points: 0,
        total_scores: 0,
        matches_played: 0
      });

      toast({
        title: "Moved to Reserve",
        description: `${player.name} has been moved to reserve. Their slot is now free.`,
      });


      await loadAdminData();
    } catch (error) {
      console.error('Error moving player to reserve:', error);
      toast({
        title: "Update Failed",
        description: "Failed to move player to reserve",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsLoading(true);
      
      // Use props data if available, otherwise load from Firestore
      const playersData = players || [];
      const femaleMatchesData = femaleMatches || [];
      const maleMatchesData = maleMatches || [];
      
      console.log('=== ADMIN PANEL PDF EXPORT ===');
      console.log('Players from props:', playersData.length, playersData);
      console.log('Female matches from props:', femaleMatchesData.length, femaleMatchesData);
      console.log('Male matches from props:', maleMatchesData.length, maleMatchesData);
      console.log('Tournament date:', tournamentDate || settings?.tournament_date || '');
      
      // Allow export if there's ANY data (players or matches)
      const hasPlayers = playersData.length > 0;
      const hasMatches = femaleMatchesData.length > 0 || maleMatchesData.length > 0;

      if (!hasPlayers && !hasMatches) {
        toast({
          title: "No Data",
          description: "No tournament data available to export.",
          variant: "destructive",
        });
        return;
      }
      
      // Load championship final result (finalMatches/current)
      let finalMatch: FinalMatchInfo | undefined;
      try {
        const fmSnap = await getDoc(doc(db, 'finalMatches', 'current'));
        if (fmSnap.exists()) {
          const fm: any = fmSnap.data();
          const nameById = (id: any): string =>
            playersData.find((p: any) => p.id === id)?.name || '';
          const males = playersData.filter((p: any) => p.gender === 'male');
          const females = playersData.filter((p: any) => p.gender === 'female');

          const king = nameById(fm.male_king_id);
          const queen = nameById(fm.female_queen_id);
          const prince = nameById(fm.male_prince_id);
          const princess = nameById(fm.female_princess_id);

          let winnerTeam: number | null =
            fm.winner_team === 1 || fm.winner_team === 'team1' ? 1 :
            fm.winner_team === 2 || fm.winner_team === 'team2' ? 2 : null;

          const isCompleted = !!fm.is_completed;

          // Fallback winner from set scores
          if (!winnerTeam && isCompleted) {
            const t1 = [fm.team1_set1, fm.team1_set2, fm.team1_set3];
            const t2 = [fm.team2_set1, fm.team2_set2, fm.team2_set3];
            let s1 = 0, s2 = 0;
            for (let i = 0; i < 3; i++) {
              if ((t1[i] ?? 0) > (t2[i] ?? 0)) s1++;
              else if ((t2[i] ?? 0) > (t1[i] ?? 0)) s2++;
            }
            winnerTeam = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
          }

          // Bracket teams: Team 1 = Male #1 & Female #2, Team 2 = Male #2 & Female #1.
          // Stored royal IDs always reflect the final titles, so map them back to bracket sides.
          let teamAMale: string, teamAFemale: string, teamBMale: string, teamBFemale: string;
          if (winnerTeam === 2) {
            teamAMale = prince || males[1]?.name || 'TBD';
            teamAFemale = princess || females[0]?.name || 'TBD';
            teamBMale = king || males[0]?.name || 'TBD';
            teamBFemale = queen || females[1]?.name || 'TBD';
          } else {
            teamAMale = king || males[0]?.name || 'TBD';
            teamAFemale = queen || females[1]?.name || 'TBD';
            teamBMale = prince || males[1]?.name || 'TBD';
            teamBFemale = princess || females[0]?.name || 'TBD';
          }

          finalMatch = {
            isCompleted,
            teamAMale,
            teamAFemale,
            teamBMale,
            teamBFemale,
            setsTeamA: [fm.team1_set1 ?? null, fm.team1_set2 ?? null, fm.team1_set3 ?? null],
            setsTeamB: [fm.team2_set1 ?? null, fm.team2_set2 ?? null, fm.team2_set3 ?? null],
            winnerTeam,
          };
        }
      } catch (fmError) {
        console.warn('Could not load final match for PDF:', fmError);
      }

      await exportMatchupsToPDF({
        players: playersData,
        femaleMatches: femaleMatchesData,
        maleMatches: maleMatchesData,
        tournamentDate: tournamentDate || settings?.tournament_date || '',
        tournamentCity: tournamentCity,
        finalMatch
      });
      
      toast({
        title: "PDF Exported",
        description: "Matchups have been exported to PDF successfully",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export matchups to PDF",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToPlaceholders = async () => {
    try {
      setIsLoading(true);
      await resetPlayersToPlaceholders();
      
      toast({
        title: "Players Reset",
        description: "All players have been reset to placeholder names. Registration can now begin fresh.",
      });
      
      setConfirmingReset(false);
      await loadAdminData();
    } catch (error) {
      console.error('Error resetting players:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset players to placeholders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeDatabase = async () => {
    try {
      setIsLoading(true);
      // Initialize Firebase database
      await initializePlayers();
      await initializeMatches();
      
      toast({
        title: "Database Initialized",
        description: "Tournament database has been set up with placeholder players and is ready for registration.",
      });
      
      setConfirmingInit(false);
      await loadAdminData();
    } catch (error) {
      console.error('Error initializing database:', error);
      toast({
        title: "Initialization Failed",
        description: "Failed to initialize tournament database",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const maleCount = confirmedPlayers.filter(p => p.gender === 'male').length;
  const femaleCount = confirmedPlayers.filter(p => p.gender === 'female').length;

  if (isLoading) {
    return (
      <div className="fixed inset-4 z-50 bg-white border-2 border-purple-200 shadow-xl rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce-gentle">⚙️</div>
          <p className="text-lg font-semibold">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 z-50 bg-white border-2 border-purple-200 shadow-xl rounded-lg overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ocean flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Admin Panel
          </h2>
          <Button
            onClick={onClose}
            variant="outline"
            className="hover:bg-coral hover:text-white"
          >
            Close
          </Button>
        </div>

        {/* Tournament Settings */}
        <Card className="border-ocean/20 bg-ocean/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-ocean">
              <Calendar className="w-5 h-5" />
              Tournament Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings && (
              <div className="text-sm text-foreground/70">
                <p>Registration closes {settings.registration_cutoff_days} days before tournament</p>
                <p>Max {settings.max_players_per_gender} players per gender</p>
              </div>
            )}
            
            <div className="pt-4 border-t border-ocean/20 space-y-3">
              {confirmingInit ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-amber-800 font-medium">
                    This will reset ALL data. Are you sure?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleInitializeDatabase}
                      disabled={isLoading}
                      size="sm"
                      className="flex-1 bg-palm hover:bg-palm-dark text-white"
                    >
                      Yes, Initialize
                    </Button>
                    <Button
                      onClick={() => setConfirmingInit(false)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setConfirmingInit(true)}
                  disabled={isLoading}
                  className="w-full bg-palm hover:bg-palm-dark text-white"
                >
                  Initialize Tournament Database
                </Button>
              )}
              <p className="text-xs text-foreground/60">
                Complete setup with placeholder players and fresh tournament settings.
              </p>
              
              {confirmingReset ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-800 font-medium">
                    Reset all players to placeholders?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleResetToPlaceholders}
                      disabled={isLoading}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      Yes, Reset
                    </Button>
                    <Button
                      onClick={() => setConfirmingReset(false)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setConfirmingReset(true)}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full"
                >
                  Reset Players Only
                </Button>
              )}
              <p className="text-xs text-foreground/60">
                Reset only players to placeholders, keeping existing matches and settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Registration Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-ocean/20 bg-ocean/10">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-ocean" />
              <h3 className="font-semibold text-ocean">Male Players</h3>
              <p className="text-2xl font-bold text-ocean">{maleCount}/8</p>
            </CardContent>
          </Card>
          
          <Card className="border-sunset/20 bg-sunset/10">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-sunset" />
              <h3 className="font-semibold text-sunset">Female Players</h3>
              <p className="text-2xl font-bold text-sunset">{femaleCount}/8</p>
            </CardContent>
          </Card>
        </div>

        {/* Export Matchups PDF */}
        <Card className="border-palm/20 bg-palm/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-palm">
              <FileText className="w-5 h-5" />
              Export Tournament Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExportPDF}
              disabled={isLoading}
              className="w-full bg-palm hover:bg-palm-dark text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export Matchups as PDF
            </Button>
            <p className="text-xs text-foreground/60 mt-2">
              Download a printable PDF with all players and match schedules.
            </p>
          </CardContent>
        </Card>

        {/* Run Team Draw */}
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Shuffle className="w-5 h-5" />
              Tournament Draw
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/draw')}
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Run Team Draw
            </Button>
            <p className="text-xs text-foreground/60 mt-2">
              Shuffle players and generate random match pairings for the tournament.
            </p>
          </CardContent>
        </Card>

        {/* Pending Registrations */}
        <Card className="border-amber/20 bg-amber/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Pending Registrations ({pendingPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPlayers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No pending registrations.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-amber/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{player.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          player.gender === 'male' 
                            ? 'bg-ocean/20 text-ocean' 
                            : 'bg-sunset/20 text-sunset'
                        }`}>
                          {player.gender}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-amber/20 text-amber-700">
                          pending
                        </span>
                        {player.is_reserve && (
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                            reserve
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-foreground/60 min-w-0">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="break-words">{player.email}</span>
                      </div>
                      <div className="text-xs text-foreground/50">
                        Registered: {new Date(player.registered_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => handleApprovePlayer(player)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePendingPlayer(player)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmed Players */}
        <Card className="border-palm/20 bg-palm/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-palm">
              <Crown className="w-5 h-5" />
              Confirmed Players ({confirmedPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {confirmedPlayers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No players have registered yet.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {confirmedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-sand-dark/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{player.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          player.gender === 'male' 
                            ? 'bg-ocean/20 text-ocean' 
                            : 'bg-sunset/20 text-sunset'
                        }`}>
                          {player.gender}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-foreground/60 min-w-0">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="break-words">{player.email}</span>
                      </div>
                      <div className="text-xs text-foreground/50">
                        Registered: {new Date(player.registered_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUnapprovePlayer(player.id, player.name)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Pending
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMoveToReserve(player)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Shuffle className="w-4 h-4 mr-1" />
                        Reserve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePlayer(player.id, player.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registration Status */}
        {(maleCount >= 8 || femaleCount >= 8) && (
          <Alert className="border-coral/30 bg-coral/10">
            <AlertDescription className="text-coral-dark">
              {maleCount >= 8 && femaleCount >= 8 
                ? "🎉 Tournament is full! Both divisions have reached maximum capacity."
                : maleCount >= 8 
                ? "Male division is full. Female division still accepting registrations."
                : "Female division is full. Male division still accepting registrations."
              }
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

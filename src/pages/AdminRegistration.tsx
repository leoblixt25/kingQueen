import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/config/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { AdminPanel } from "@/components/AdminPanel";
import { loadMatches } from "@/utils/firebaseUtils";
import { buildPlayersMap, resolveMatchPlayers } from "@/utils/matchPlayerResolver";
import { Player, ResolvedMatch } from "@/types";

export default function AdminRegistration() {
  const navigate = useNavigate();
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentCity, setTournamentCity] = useState("");
  const [players, setPlayers] = useState<(Player & { gender: string })[]>([]);
  const [femaleMatches, setFemaleMatches] = useState<ResolvedMatch[]>([]);
  const [maleMatches, setMaleMatches] = useState<ResolvedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const settingsRef = doc(db, 'tournamentSettings', 'default_settings');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setTournamentDate(data.tournament_date || '');
        setTournamentCity(data.tournament_city || '');
      }

      const playersRef = collection(db, 'players');
      const approvedSnap = await getDocs(query(playersRef, where('status', '==', 'approved')));
      const approved = approvedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player & { gender: string }));

      const female = approved.filter(p => p.gender === 'female');
      const male = approved.filter(p => p.gender === 'male');

      setPlayers([...female, ...male]);

      const playersMap = buildPlayersMap(female, male);
      const { femaleMatches: femaleMatchesData, maleMatches: maleMatchesData } = await loadMatches();
      setFemaleMatches(resolveMatchPlayers(femaleMatchesData, playersMap));
      setMaleMatches(resolveMatchPlayers(maleMatchesData, playersMap));
    } catch (error) {
      console.error('Error loading registration panel data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce-gentle">⚙️</div>
          <p className="text-lg font-semibold">Loading Registration Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient">
      <AdminPanel
        fullPage
        onClose={() => navigate('/admin/control')}
        players={players}
        femaleMatches={femaleMatches}
        maleMatches={maleMatches}
        tournamentDate={tournamentDate}
        tournamentCity={tournamentCity}
      />
    </div>
  );
}
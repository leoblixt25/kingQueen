import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Users, Info, Trophy, Shuffle, Download, Home, BatteryMedium, type LucideIcon } from "lucide-react";
import { auth, db } from "@/config/firebase";
import { collection, onSnapshot } from "firebase/firestore";

const GOLD_TEXT = "bg-[linear-gradient(180deg,#fff3c4_0%,#f6d470_45%,#c9962b_100%)] bg-clip-text text-transparent";
const GOLD_BTN = "bg-[linear-gradient(180deg,#f8e396_0%,#e9c35c_50%,#c9972e_100%)] text-[#241502] shadow-[0_10px_30px_-8px_rgba(212,175,55,0.55),inset_0_2px_2px_rgba(255,255,255,0.55),inset_0_-3px_6px_rgba(90,55,5,0.45)] border border-[#f7e9ae]/70";

const NAV_ITEMS: { label: string; icon: LucideIcon; path: string; match: (pathname: string) => boolean }[] = [
  { label: "Home", icon: Home, path: "/", match: (p) => p === "/" },
  { label: "Player", icon: Users, path: "/player", match: (p) => p.startsWith("/player") },
  { label: "Info", icon: Info, path: "/info", match: (p) => p.startsWith("/info") },
  { label: "Tournament Draw", icon: Shuffle, path: "/tournament-draw", match: (p) => p.startsWith("/draw") || p.startsWith("/tournament-draw") },
  { label: "Live Ranking", icon: Trophy, path: "/live-ranking", match: (p) => p.startsWith("/live-ranking") },
  { label: "Admin", icon: Crown, path: "/admin", match: (p) => p.startsWith("/admin") },
];

export default function Landing() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isAdminRegistered, setIsAdminRegistered] = useState(false);
  const [finishedMatches, setFinishedMatches] = useState(0);

  useEffect(() => {
    checkAdminStatus();
    
    const matchesRef = collection(db, 'matches');
    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      const allMatches = snapshot.docs.map(doc => doc.data());
      const finished = allMatches.filter(match => 
        match.is_completed || (match.score1 !== undefined && match.score2 !== undefined && match.score1 > 0 && match.score2 > 0)
      ).length;
      setFinishedMatches(finished);
    });
    
    return () => unsubscribeMatches();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const user = auth.currentUser;
      // In a real app, you would check if the user has admin role
      // For now, we'll just check if user is authenticated
      setIsAdminRegistered(!!user);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const handleAdminClick = () => {
    navigate('/admin/login');
  };

  const handlePlayerClick = () => {
    navigate('/player-access');
  };

  const handleInfoClick = () => {
    navigate('/info');
  };

  const handleLiveRankingClick = () => {
    navigate('/live-ranking');
  };

  const handleInstallClick = () => {
    navigate('/install');
  };

  const handleDrawClick = () => {
    navigate('/draw-live');
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-between"
      style={{
        backgroundColor: "#070d1c",
        backgroundImage: 'linear-gradient(180deg,#131f3d_0%,#0a1326_55%,#070d1c_100%),url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundBlendMode: "normal,overlay",
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,#2c4a7f_0%,transparent_60%)]" />

      <div className="relative w-full max-w-md mx-auto flex flex-col items-center px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div className="w-full flex items-center justify-between text-[#f6d470] mt-4">
          <span className="text-sm font-medium tracking-wide">21:25</span>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span>5G</span>
            <BatteryMedium className="w-5 h-5" />
            <span>52%</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center text-center animate-fade-in">
          <Crown className="w-12 h-12 text-[#e9c35c] drop-shadow-[0_2px_6px_rgba(212,175,55,0.7)]" />
          <h1 className={`font-serif font-bold text-6xl sm:text-7xl tracking-tight leading-none ${GOLD_TEXT} drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]`}>
            K &amp; Q
          </h1>
          <p className={`mt-3 font-serif text-lg sm:text-xl tracking-[0.18em] uppercase ${GOLD_TEXT} drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]`}>
            King &amp; Queen of the Beach
          </p>
        </div>

        <div className="w-full space-y-4 mt-10">
          <Button
            onClick={handleAdminClick}
            className={`w-full py-6 text-lg font-serif font-bold rounded-2xl ${GOLD_BTN} flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.99]`}
          >
            <Crown className="w-6 h-6 text-[#2a1a02] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" />
            Admin
          </Button>
          <Button
            onClick={handlePlayerClick}
            className={`w-full py-6 text-lg font-serif font-bold rounded-2xl ${GOLD_BTN} flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.99]`}
          >
            <Users className="w-6 h-6 text-[#2a1a02] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" />
            Player
          </Button>
          <Button
            onClick={handleInfoClick}
            className={`w-full py-6 text-lg font-serif font-bold rounded-2xl ${GOLD_BTN} flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.99]`}
          >
            <Info className="w-6 h-6 text-[#2a1a02] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" />
            Info
          </Button>
          <Button
            onClick={handleDrawClick}
            className={`w-full py-6 text-lg font-serif font-bold rounded-2xl ${GOLD_BTN} flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.99]`}
          >
            <Shuffle className="w-6 h-6 text-[#2a1a02] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" />
            Tournament Draw
          </Button>

          <Button
            onClick={handleLiveRankingClick}
            className={`w-full py-6 text-lg font-serif font-bold rounded-2xl bg-[#0b1426]/95 border-2 border-[#d4af37]/80 text-[#e8c86a] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(212,175,55,0.15)] hover:border-[#d4af37] hover:bg-[#101b31] transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-3`}
          >
            <Trophy className="w-6 h-6 text-[#d4af37]" />
            <span>Live Ranking</span>
            <span className={`w-3 h-3 rounded-full border border-white/50 ${finishedMatches === 28 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse' : 'bg-[#2f7bff] shadow-[0_0_12px_rgba(47,123,255,1)]'}`} />
          </Button>
        </div>

        <div className="mt-5">
          <Button
            onClick={handleInstallClick}
            className="text-[#e8c86a] border-2 border-[#d4af37]/60 rounded-2xl py-5 px-6 bg-transparent hover:bg-[#d4af37]/10 transition-all duration-200 hover:scale-[1.02] flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Install App
          </Button>
        </div>

        <div className="mt-10 text-center">
          <p className="font-serif text-sm text-[#c9a558]">
            Designed and created by <span className="font-bold text-[#e8c86a]">Leo Blixt</span> with a love for beach volleyball
          </p>
        </div>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#070d1c]/95 backdrop-blur-md border-t border-[#d4af37]/30 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto flex items-stretch">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 touch-target"
                aria-label={item.label}
              >
                <span className={`relative w-12 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  active ? "bg-[#d4af37]/15 text-[#f6d470] shadow-[0_0_14px_rgba(212,175,55,0.55)]" : "text-[#d4af37]/70"
                }`}>
                  <Icon className="w-5 h-5" />
                  {item.label === "Live Ranking" && finishedMatches > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)] border border-white/60" />
                  )}
                </span>
                <span className={`text-[10px] leading-tight text-center font-semibold ${active ? "text-[#f6d470]" : "text-[#d4af37]/60"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Info, Shuffle, Trophy, Crown, type LucideIcon } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: Home, path: "/", match: (p) => p === "/" },
  { label: "Player", icon: Users, path: "/player", match: (p) => p.startsWith("/player") },
  { label: "Draw", icon: Shuffle, path: "/tournament-draw", match: (p) => p.startsWith("/draw") || p.startsWith("/tournament-draw") },
  { label: "Ranking", icon: Trophy, path: "/live-ranking", match: (p) => p.startsWith("/live-ranking") },
  { label: "Info", icon: Info, path: "/info", match: (p) => p.startsWith("/info") },
  { label: "Admin", icon: Crown, path: "/admin", match: (p) => p.startsWith("/admin") },
];

export default function BottomNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [finishedMatches, setFinishedMatches] = useState(0);

  useEffect(() => {
    const matchesRef = collection(db, "matches");
    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      const allMatches = snapshot.docs.map((doc) => doc.data());
      const finished = allMatches.filter((match) =>
        match.is_completed || (match.score1 !== undefined && match.score2 !== undefined && match.score1 > 0 && match.score2 > 0)
      ).length;
      setFinishedMatches(finished);
    });
    return () => unsubscribeMatches();
  }, []);

  const isLiveActive = finishedMatches > 0;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-t border-sand-dark/20 rounded-t-2xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
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
                active ? "bg-beach-gradient text-white shadow-beach" : "bg-transparent"
              }`}>
                <Icon className="w-5 h-5" />
                {item.label === "Ranking" && isLiveActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)] border-2 border-white" />
                )}
              </span>
              <span className={`text-[10px] leading-tight text-center font-semibold ${active ? "text-ocean" : "text-foreground/60"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
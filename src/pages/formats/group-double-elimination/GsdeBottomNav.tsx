import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Crown,
  Home,
  Info,
  Shuffle,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { selectProgress } from "@/formats/group-double-elimination/scoring";
import {
  DEFAULT_GSDE_TOURNAMENT_ID,
  gsdeHref,
  useGsdeTournament,
} from "./shared";

const FORMAT_ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

interface NavItem {
  label: string;
  icon: LucideIcon;
  route: string;
  live?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: Home, route: FORMAT_ROUTE },
  { label: "Player", icon: Users, route: `${FORMAT_ROUTE}/player-access` },
  { label: "Draw", icon: Shuffle, route: `${FORMAT_ROUTE}/draw` },
  { label: "Ranking", icon: Trophy, route: `${FORMAT_ROUTE}/ranking`, live: true },
  { label: "Info", icon: Info, route: `${FORMAT_ROUTE}/info` },
  { label: "Admin", icon: Crown, route: `${FORMAT_ROUTE}/admin` },
];

/** K&Q-style bottom menu banner, wired to the group-stage format routes. */
export default function GsdeBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const currentId =
    searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;
  const { doc } = useGsdeTournament();

  const progress = doc ? selectProgress(doc) : null;
  const hasResults = Boolean(
    progress && (progress.groups.completed > 0 || progress.eliminationComplete > 0)
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/70 backdrop-blur-md border-t border-sand-dark/20 rounded-t-2xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.route || pathname.startsWith(`${item.route}/`);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(gsdeHref(item.route, currentId))}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 touch-target"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={`relative w-12 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  active ? "bg-beach-gradient text-white shadow-beach" : "bg-transparent"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.live && hasResults ? (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)] border-2 border-white" />
                ) : null}
              </span>
              <span
                className={`text-[10px] leading-tight text-center font-semibold ${
                  active ? "text-ocean" : "text-foreground/60"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

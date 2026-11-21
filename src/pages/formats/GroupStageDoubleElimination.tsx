import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Crown,
  Download,
  Info,
  LayoutDashboard,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { selectProgress } from "@/formats/group-double-elimination/scoring";
import {
  GsdeMainTitle,
  gsdeHref,
  useGsdeTournament,
} from "./group-double-elimination/shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/**
 * K&Q-style start hub for the group-stage format. The tables that used to live
 * on this page now have their own Draw / Ranking / Info routes; this page only
 * provides the beach-themed navigation, exactly like the King & Queen landing.
 */
export default function GroupStageDoubleElimination() {
  const navigate = useNavigate();
  const { id, doc } = useGsdeTournament();
  const progress = doc ? selectProgress(doc) : null;

  const go = (route: string) => navigate(gsdeHref(route, id));

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-24 pb-8 flex items-start justify-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/")}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark hover:bg-transparent"
      >
        <ArrowLeft className="w-4 h-4" />
        Formats
      </Button>

      <div className="w-full max-w-md mx-auto text-center animate-fade-in">
        <div className="mb-4 animate-bounce-gentle">
          <div className="text-6xl md:text-7xl">🏐</div>
        </div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-2">
          <GsdeMainTitle />
        </div>
        <p className="mb-6 text-sm text-foreground/65">
          16 teams · 4 groups of 4 · standard double elimination
        </p>

        <div className="space-y-4">
          <Button
            onClick={() => go(`${ROUTE}/overview`)}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-[#0A1E39] via-[#3450D5] to-[#5B78E8] hover:from-[#0A1E39] hover:via-[#2B45B8] hover:to-[#3450D5] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <LayoutDashboard className="w-6 h-6 text-[#F5C451]" />
            Tournament Overview
          </Button>
          <Button
            onClick={() => go(`${ROUTE}/draw`)}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Shuffle className="w-6 h-6" />
            Tournament Draw
          </Button>
          <Button
            onClick={() => go(`${ROUTE}/ranking`)}
            className="w-full py-7 text-xl font-bold bg-beach-gradient hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Trophy className="w-6 h-6" />
            <span>Live Ranking</span>
            <span
              className={`w-3 h-3 rounded-full border-2 border-white ${
                progress?.champion
                  ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                  : "bg-green-400 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.9)]"
              }`}
            />
          </Button>
          <Button
            onClick={() => go(`${ROUTE}/player-access`)}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-ocean to-ocean-light hover:from-ocean-dark hover:to-ocean text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Users className="w-6 h-6" />
            Player
          </Button>
          <Button
            onClick={() => go(`${ROUTE}/info`)}
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-palm to-palm-light hover:from-palm-dark hover:to-palm text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Info className="w-6 h-6" />
            Info
          </Button>
          <Button
            onClick={() => go(`${ROUTE}/admin`)}
            className="w-full py-5 text-base font-semibold bg-white/50 text-foreground/70 border border-sand-dark/40 hover:bg-white/80 hover:text-foreground shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-3 rounded-2xl"
          >
            <Crown className="w-5 h-5 text-foreground/50" />
            Admin
          </Button>
        </div>

        <div className="mt-6">
          <Button
            onClick={() => navigate("/install")}
            variant="outline"
            size="sm"
            className="text-ocean border-ocean/60 bg-ocean/5 hover:bg-ocean hover:text-white hover:border-ocean font-semibold shadow-sm transition-all duration-200"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Install App
          </Button>
        </div>

        <div className="mt-10 text-sm text-foreground/60 text-center">
          <p>
            Designed and created by <span className="font-bold text-foreground/80">Leo Blixt</span>{" "}
            with a love for beach volleyball
          </p>
        </div>
      </div>
    </div>
  );
}

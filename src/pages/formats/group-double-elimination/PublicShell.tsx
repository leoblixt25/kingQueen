import { type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { DEFAULT_GSDE_TOURNAMENT_ID, gsdeHref } from "./shared";

const FORMAT_ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

interface GsdePublicShellProps {
  emoji: string;
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel: string;
  wide?: boolean;
  /** Small status chip under the title, e.g. the tournament stage. */
  badge?: ReactNode;
  /** Extra header content, e.g. the EN/ES picker on the info page. */
  headerExtra?: ReactNode;
  showAutoFooter?: boolean;
  children: ReactNode;
}

/** K&Q-style public shell for the draw and ranking screens. */
export function GsdePublicShell({
  emoji,
  title,
  subtitle,
  backTo,
  backLabel,
  wide = false,
  badge,
  headerExtra,
  showAutoFooter = true,
  children,
}: GsdePublicShellProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentId =
    searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;

  return (
    <div className="min-h-screen bg-sand-gradient px-4 pt-6 pb-6">
      <div
        className={`w-full mx-auto animate-fade-in ${
          wide ? "max-w-6xl" : "max-w-lg"
        }`}
      >
        <div className="relative flex justify-center">
          <Button
            variant="ghost"
            onClick={() => navigate(backTo)}
            className="touch-target absolute left-0 top-0 px-2 text-foreground/70 hover:text-foreground hover:bg-transparent"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {backLabel}
          </Button>
        </div>

        <header className="text-center space-y-3 mt-4 mb-6">
          <div className="text-5xl animate-bounce-gentle">{emoji}</div>
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-beach-gradient bg-clip-text drop-shadow-sm">
            {title}
          </h1>
          <div className="w-16 h-1 bg-sunset mx-auto rounded-full" />
          {subtitle ? (
            <p className="text-sm text-foreground/70">{subtitle}</p>
          ) : null}
          {badge}
          {headerExtra}
        </header>

        <div className="space-y-6">{children}</div>

        {showAutoFooter ? (
          <div className="mt-10 text-center text-xs text-foreground/60">
            <p>Updates automatically · Public view</p>
            <Link
              to={gsdeHref(FORMAT_ROUTE, currentId)}
              className="mt-1 inline-block font-semibold text-ocean hover:underline"
            >
              Back to tournament
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface GsdeTabDef {
  id: string;
  label: string;
  tone?: "sunset" | "ocean" | "beach";
}

/** K&Q-style segmented tabs, full-width and touch friendly on mobile. */
export function GsdeTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: GsdeTabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const tone = tab.tone ?? "ocean";
        const activeClass =
          tone === "sunset"
            ? "bg-sunset hover:bg-sunset-dark text-white shadow-beach"
            : tone === "beach"
              ? "bg-beach-gradient hover:opacity-90 text-white shadow-beach"
              : "bg-ocean hover:bg-ocean-dark text-white shadow-beach";
        const idleClass =
          tone === "sunset"
            ? "bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand"
            : tone === "beach"
              ? "bg-white/70 hover:bg-beach-gradient hover:text-white border-primary/30 text-primary shadow-sand"
              : "bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand";
        return (
          <Button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-0 touch-target font-semibold text-xs sm:text-base leading-tight py-3 transition-all duration-300 ${
              isActive ? activeClass : idleClass
            }`}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

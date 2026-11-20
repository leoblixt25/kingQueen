import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Crown,
  Download,
  GitBranch,
  Volleyball,
} from "lucide-react";
import {
  GROUP_DOUBLE_ELIMINATION_FORMAT,
  KING_QUEEN_FORMAT,
} from "@/formats";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-sand-gradient">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-white/10 to-ocean-light/15"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl animate-fade-in flex-col px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
        <header className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean via-ocean-light to-sunset text-white shadow-beach ring-4 ring-white/70 sm:h-16 sm:w-16">
            <Volleyball className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} />
          </div>
          <h1 className="mt-5 text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:mt-6 sm:text-4xl lg:text-[2.6rem]">
            <span className="bg-gradient-to-r from-sunset via-ocean-light to-ocean bg-clip-text text-transparent">
              Beach Volleyball
            </span>{" "}
            Organizer
          </h1>
          <p className="mt-3 text-sm font-medium text-foreground/70 sm:text-base">
            Choose your tournament format
          </p>
        </header>

        <main className="mt-9 grid items-stretch gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6">
          <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-sand-dark/25 bg-white/85 !shadow-sand backdrop-blur-sm transition-all duration-200 md:hover:-translate-y-1 md:hover:border-amber-500/40 md:hover:!shadow-beach">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500"
            />
            <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunset/10 text-sunset-dark ring-1 ring-sunset/20">
                  <Crown className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-bold leading-snug tracking-tight sm:text-xl">
                    {KING_QUEEN_FORMAT.name}
                  </CardTitle>
                  {KING_QUEEN_FORMAT.status === "live" ? (
                    <Badge className="mt-2 gap-1.5 bg-palm-light/20 text-palm-dark ring-1 ring-palm/20 hover:bg-palm-light/20">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-palm"
                      />
                      Live
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardDescription className="mt-4 text-sm leading-relaxed text-foreground/70">
                {KING_QUEEN_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-5 pt-0 sm:p-6 sm:pt-0">
              <Button
                onClick={() => navigate(KING_QUEEN_FORMAT.route)}
                className="group mt-auto h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-amber-600 hover:to-orange-600 hover:shadow-beach active:scale-[0.99] active:from-amber-700 active:to-orange-700 focus-visible:ring-amber-500"
              >
                Enter King &amp; Queen
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </CardContent>
          </Card>

          <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-sand-dark/25 bg-white/85 !shadow-sand backdrop-blur-sm transition-all duration-200 md:hover:-translate-y-1 md:hover:border-ocean/30 md:hover:!shadow-beach">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-ocean-gradient"
            />
            <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ocean/10 text-ocean ring-1 ring-ocean/20">
                  <GitBranch className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-bold leading-snug tracking-tight sm:text-xl">
                    {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
                  </CardTitle>
                  {GROUP_DOUBLE_ELIMINATION_FORMAT.status === "live" ? (
                    <Badge className="mt-2 gap-1.5 bg-ocean/10 text-ocean-dark ring-1 ring-ocean/15 hover:bg-ocean/10">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-ocean"
                      />
                      Live
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardDescription className="mt-4 text-sm leading-relaxed text-foreground/70">
                {GROUP_DOUBLE_ELIMINATION_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-5 pt-0 sm:p-6 sm:pt-0">
              <Button
                onClick={() => navigate(GROUP_DOUBLE_ELIMINATION_FORMAT.route)}
                className="group mt-auto h-12 w-full rounded-xl bg-ocean-gradient text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-105 hover:shadow-beach active:scale-[0.99] active:brightness-95 focus-visible:ring-ocean"
              >
                View new format
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </CardContent>
          </Card>
        </main>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => navigate("/install")}
            variant="outline"
            size="sm"
            className="h-10 min-h-[44px] rounded-xl border-ocean/25 bg-white/60 px-5 text-xs font-semibold text-ocean shadow-sm transition-all duration-200 hover:border-ocean/50 hover:bg-ocean/5 hover:text-ocean-dark active:scale-[0.98] sm:h-9 sm:min-h-0 sm:px-4"
          >
            <Download className="h-4 w-4" />
            Install App
          </Button>
        </div>

        <footer className="mt-auto pt-10 text-center text-xs text-foreground/60 sm:text-sm">
          <p className="mx-auto max-w-md leading-relaxed">
            Designed and created by{" "}
            <span className="font-semibold text-foreground/80">Leo Blixt</span>{" "}
            with a love for beach volleyball
          </p>
        </footer>
      </div>
    </div>
  );
}

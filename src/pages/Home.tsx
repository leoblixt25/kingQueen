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
import { ArrowRight, Crown, Download, GitBranch } from "lucide-react";
import {
  GROUP_DOUBLE_ELIMINATION_FORMAT,
  KING_QUEEN_FORMAT,
} from "@/formats";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-20 pb-10 flex items-start justify-center">
      <div className="w-full max-w-md mx-auto text-center animate-fade-in">
        <div className="mb-5 animate-bounce-gentle">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-ocean via-ocean-light to-sunset text-4xl shadow-beach ring-4 ring-white/70">
            🏐
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
          <span className="bg-gradient-to-r from-ocean via-sunset to-coral bg-clip-text text-transparent drop-shadow-sm">
            Beach Volleyball
          </span>{" "}
          <span className="text-foreground/85">Organizer</span>
        </h1>
        <p className="mt-2 mb-8 text-sm sm:text-base text-foreground/65">
          Choose your tournament format
        </p>

        <div className="space-y-4 text-left">
          <Card className="group border-sand-dark/40 bg-card/95 shadow-beach transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm ring-1 ring-black/5">
                  <Crown className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-lg leading-tight">
                    {KING_QUEEN_FORMAT.name}
                  </CardTitle>
                  {KING_QUEEN_FORMAT.status === "live" ? (
                    <Badge className="mt-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Live
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardDescription className="pt-3 text-sm leading-relaxed">
                {KING_QUEEN_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate(KING_QUEEN_FORMAT.route)}
                className="w-full py-6 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2 rounded-2xl"
              >
                Enter King &amp; Queen
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-sand-dark/40 bg-card/95 shadow-beach transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ocean-gradient text-white shadow-sm ring-1 ring-black/5">
                  <GitBranch className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-lg leading-tight">
                    {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
                  </CardTitle>
                  {GROUP_DOUBLE_ELIMINATION_FORMAT.status === "in-development" ? (
                    <Badge variant="secondary" className="mt-1.5">
                      Coming soon
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardDescription className="pt-3 text-sm leading-relaxed">
                {GROUP_DOUBLE_ELIMINATION_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => navigate(GROUP_DOUBLE_ELIMINATION_FORMAT.route)}
                className="w-full py-6 text-base font-bold bg-ocean-gradient hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2 rounded-2xl"
              >
                View new format
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
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
            Designed and created by{" "}
            <span className="font-bold text-foreground/80">Leo Blixt</span> with a
            love for beach volleyball
          </p>
        </div>
      </div>
    </div>
  );
}

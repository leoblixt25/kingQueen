import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Crown, Download, GitBranch } from "lucide-react";
import {
  GROUP_DOUBLE_ELIMINATION_FORMAT,
  KING_QUEEN_FORMAT,
} from "@/formats";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-24 pb-8 flex items-start justify-center">
      <div className="w-full max-w-md mx-auto text-center animate-fade-in">
        <div className="mb-4 animate-bounce-gentle">
          <div className="text-6xl md:text-7xl">🏐</div>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
          Beach Volleyball
        </h1>
        <p className="text-foreground/70 mb-8">Choose your tournament format</p>

        <div className="space-y-4 text-left">
          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                  <Crown className="h-6 w-6" />
                </span>
                <CardTitle className="text-xl leading-tight">
                  {KING_QUEEN_FORMAT.name}
                </CardTitle>
              </div>
              <CardDescription className="pt-1">
                {KING_QUEEN_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate(KING_QUEEN_FORMAT.route)}
                className="w-full py-6 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2 rounded-2xl"
              >
                Enter King &amp; Queen
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ocean-gradient text-white shadow-sm">
                  <GitBranch className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-xl leading-tight">
                    {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
                  </CardTitle>
                  {GROUP_DOUBLE_ELIMINATION_FORMAT.status ===
                    "in-development" && (
                    <Badge variant="secondary" className="mt-1.5">
                      Coming soon
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="pt-1">
                {GROUP_DOUBLE_ELIMINATION_FORMAT.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() =>
                  navigate(GROUP_DOUBLE_ELIMINATION_FORMAT.route)
                }
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

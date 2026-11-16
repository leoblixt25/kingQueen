import { Link } from "react-router-dom";
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
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Layers,
  RotateCcw,
  Trophy,
} from "lucide-react";
import {
  GROUP_DOUBLE_ELIMINATION_FORMAT,
  KING_QUEEN_FORMAT,
} from "@/formats";

const FORMAT_STEPS = [
  {
    icon: Layers,
    title: "Group stage",
    description:
      "Every team plays a configurable round robin. All teams advance, so no one is eliminated in the groups.",
  },
  {
    icon: GitBranch,
    title: "Double elimination",
    description:
      "Group results seed the bracket and every team starts with zero losses. The first loss drops a team to the Losers Bracket, the second eliminates it.",
  },
  {
    icon: Trophy,
    title: "Grand Final",
    description:
      "The Winners Bracket champion meets the Losers Bracket champion. If the Losers champion wins, one reset final decides the title.",
  },
] as const;

export default function GroupStageDoubleElimination() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-8 pb-8 flex items-start justify-center">
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Formats
        </Link>

        <div className="mt-4 text-center">
          <div className="mb-4 animate-bounce-gentle">
            <div className="text-6xl md:text-7xl">🏐</div>
          </div>
          <div className="mb-2 flex items-center justify-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
              {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
            </h1>
          </div>
          <Badge variant="secondary" className="mb-4">
            In development
          </Badge>
          <p className="text-foreground/70 max-w-lg mx-auto">
            This tournament format is being built. Below is how it will run once
            it is available.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {FORMAT_STEPS.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ocean/10 text-ocean">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="pt-1">{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="mt-6 border-ocean/30 bg-ocean/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-ocean" />
            <p className="text-sm text-foreground/75">
              Group-stage losses never count as elimination losses, and the
              draw is only generated when an admin starts it — never on page
              load.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 rounded-2xl border border-sand-dark/40 bg-white/50 p-4 text-center">
          <p className="mb-3 text-sm text-foreground/70">
            King &amp; Queen tournaments are running today.
          </p>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
            <Link to={KING_QUEEN_FORMAT.route}>
              Go to King &amp; Queen
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <div className="mt-3">
            <Link
              to={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/admin`}
              className="text-xs font-semibold text-foreground/60 hover:text-ocean hover:underline"
            >
              Admin setup
            </Link>
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-foreground/60">
          <Link to="/" className="font-semibold text-foreground/80 hover:underline">
            Back to all formats
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Trophy } from "lucide-react";

const TournamentFinished = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-sand-gradient px-4 pt-24 pb-8 flex items-start justify-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        <div className="text-6xl">🏆</div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
          Tournament Finished
        </h1>
        <Card className="bg-white/80 backdrop-blur-sm border border-ocean/20 shadow-beach">
          <CardContent className="p-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-palm/20 text-palm-dark text-xs font-semibold">
              <Trophy size={14} />
              Season completed
            </div>
            <p className="text-foreground/70 leading-relaxed">
              Thank you to all players and supporters. This tournament has now finished. Welcome back soon for our next tournament!
            </p>
          </CardContent>
        </Card>
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full touch-target"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Tournament Home
        </Button>
      </div>
    </div>
  );
};

export default TournamentFinished;

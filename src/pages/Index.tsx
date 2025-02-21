import { useState, useEffect } from "react";
import { Gender, Match, Player } from "@/types";
import { matchData } from "@/data/matches";
import GenderButton from "@/components/GenderButton";
import MatchCard from "@/components/MatchCard";
import RankingsTable from "@/components/RankingsTable";
import AdminControls from "@/components/AdminControls";
import AdminLogin from "@/components/AdminLogin";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [selectedGender, setSelectedGender] = useState<Gender>("female");
  const [matches, setMatches] = useState(matchData);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    calculateRankings();
  }, [matches, selectedGender]);

  const calculateRankings = () => {
    const playerMap = new Map<string, Player>();
    
    matches[selectedGender].forEach(match => {
      if (match.submitted && match.scoreA !== undefined && match.scoreB !== undefined) {
        // Initialize players if they don't exist
        [...match.teamA, ...match.teamB].forEach(player => {
          if (!playerMap.has(player)) {
            playerMap.set(player, { name: player, points: 0, totalScore: 0 });
          }
        });

        // Update points and scores
        if (match.scoreA > match.scoreB) {
          match.teamA.forEach(player => {
            const p = playerMap.get(player)!;
            p.points += 2;
            p.totalScore += match.scoreA!;
          });
          match.teamB.forEach(player => {
            const p = playerMap.get(player)!;
            p.points += 1;
            p.totalScore += match.scoreB!;
          });
        } else if (match.scoreB > match.scoreA) {
          match.teamB.forEach(player => {
            const p = playerMap.get(player)!;
            p.points += 2;
            p.totalScore += match.scoreB!;
          });
          match.teamA.forEach(player => {
            const p = playerMap.get(player)!;
            p.points += 1;
            p.totalScore += match.scoreA!;
          });
        }
      }
    });

    setPlayers(Array.from(playerMap.values()));
  };

  const handleScoreSubmit = (matchId: number, scoreA: number, scoreB: number) => {
    setMatches(prev => ({
      ...prev,
      [selectedGender]: prev[selectedGender].map(match =>
        match.id === matchId
          ? { ...match, scoreA, scoreB, submitted: true }
          : match
      )
    }));

    toast({
      title: "Score submitted",
      description: `Match #${matchId} scores have been updated.`,
    });
  };

  const handleResetScores = () => {
    setMatches(prev => ({
      ...prev,
      [selectedGender]: prev[selectedGender].map(match => ({
        ...match,
        scoreA: undefined,
        scoreB: undefined,
        submitted: false
      }))
    }));

    toast({
      title: "Scores reset",
      description: "All scores have been reset.",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          King & Queen of the Beach
        </h1>

        <div className="flex justify-center space-x-4 mb-8">
          <GenderButton
            gender="female"
            selected={selectedGender === "female"}
            onClick={() => setSelectedGender("female")}
          />
          <GenderButton
            gender="male"
            selected={selectedGender === "male"}
            onClick={() => setSelectedGender("male")}
          />
        </div>

        <div className="flex justify-end mb-4">
          {!isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowAdminLogin(true)}
            >
              Admin Login
            </Button>
          )}
        </div>

        {showAdminLogin && !isAdmin && (
          <AdminLogin onLogin={(success) => {
            setIsAdmin(success);
            setShowAdminLogin(false);
          }} />
        )}

        {isAdmin && <AdminControls onResetScores={handleResetScores} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Matchups</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {matches[selectedGender].map((match) => (
                <AccordionItem key={match.id} value={`match-${match.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    Match #{match.id}
                  </AccordionTrigger>
                  <AccordionContent>
                    <MatchCard
                      match={match}
                      onScoreSubmit={handleScoreSubmit}
                      isAdmin={isAdmin}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Rankings</h2>
            <RankingsTable players={players} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

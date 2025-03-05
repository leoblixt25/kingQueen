
import { Input } from "@/components/ui/input";
import { Match } from "@/types";

interface MatchTeamsProps {
  match: Match;
  isSubmitted: boolean;
  isAdmin: boolean;
  score1: string;
  score2: string;
  setScore1: (score: string) => void;
  setScore2: (score: string) => void;
}

export function MatchTeams({
  match,
  isSubmitted,
  isAdmin,
  score1,
  score2,
  setScore1,
  setScore2
}: MatchTeamsProps) {
  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-center">
          {match.player1.name} & {match.player2.name}
        </p>
        {!isSubmitted || isAdmin ? (
          <Input
            value={score1}
            onChange={(e) => setScore1(e.target.value)}
            type="number"
            className="w-20 text-center"
            inputMode="numeric"
            pattern="\d*"
            disabled={isSubmitted && !isAdmin} // Disable if submitted and not admin
          />
        ) : (
          <p className="text-xl font-bold">{match.score1}</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-center">
          {match.player3.name} & {match.player4.name}
        </p>
        {!isSubmitted || isAdmin ? (
          <Input
            value={score2}
            onChange={(e) => setScore2(e.target.value)}
            type="number"
            className="w-20 text-center"
            inputMode="numeric"
            pattern="\d*"
            disabled={isSubmitted && !isAdmin} // Disable if submitted and not admin
          />
        ) : (
          <p className="text-xl font-bold">{match.score2}</p>
        )}
      </div>
    </>
  );
}

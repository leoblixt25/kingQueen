import type {
  EliminationMatch,
  EliminationResultType,
  MatchScore,
  TeamId,
} from "./types";

/**
 * Single source of truth for an elimination result.
 *
 * The winner is always derived from the scores. New scores are checked by
 * `scoreRules.validateScore` before they reach this module, so a stored result
 * always reflects a valid beach-volleyball set (at least 21 points and a
 * two-point lead). `winnerId`/`loserId` remain on stored matches for legacy
 * documents, but no UI or routing decision may supply them independently:
 * call `getWinner(match)` instead. Legacy marker/short scores stay derivable so
 * existing tournaments keep their original progression.
 */

/** Non-played results are stored as a 1–0 marker plus a `resultType`. */
export const WALKOVER_WIN_SCORE = 1;
export const WALKOVER_LOSS_SCORE = 0;

export interface EliminationResultInput {
  scoreA?: number | null;
  scoreB?: number | null;
  /** Legacy/imported callers may supply a winner when no scores exist. */
  winnerId?: TeamId | null;
  loserId?: TeamId | null;
  resultType?: EliminationResultType;
}

export interface ResolvedEliminationResult {
  winnerId: TeamId | null;
  loserId: TeamId | null;
  scoreA: number | null;
  scoreB: number | null;
  resultType: EliminationResultType;
}

export const hasDecidableScores = (scores: MatchScore): boolean =>
  Number.isInteger(scores.scoreA) &&
  Number.isInteger(scores.scoreB) &&
  scores.scoreA !== scores.scoreB;

export const deriveWinner = (
  teamAId: TeamId | null,
  teamBId: TeamId | null,
  scoreA: number | null,
  scoreB: number | null
): TeamId | null => {
  if (!hasDecidableScores({ scoreA, scoreB })) return null;
  return scoreA! > scoreB! ? teamAId : teamBId;
};

/** The one function every routing, placement, status and display path uses. */
export const getWinner = (match: EliminationMatch): TeamId | null => {
  if (match.status !== "completed") return null;
  const fromScores = deriveWinner(
    match.teamAId,
    match.teamBId,
    match.scoreA,
    match.scoreB
  );
  if (fromScores) return fromScores;
  // Legacy matches without comparable scores keep their stored winner until
  // they are repaired by "Recompute bracket from results".
  return match.winnerId ?? null;
};

export const getLoser = (match: EliminationMatch): TeamId | null => {
  const winner = getWinner(match);
  if (!winner) return match.loserId ?? null;
  if (winner === match.teamAId) return match.teamBId;
  if (winner === match.teamBId) return match.teamAId;
  return match.loserId ?? null;
};

export const getResultType = (match: EliminationMatch): EliminationResultType =>
  match.resultType ?? "normal";

export const resultTypeBadge = (
  resultType: EliminationResultType | null | undefined
): string | null => {
  if (resultType === "walkover") return "W/O";
  if (resultType === "retired") return "RET";
  return null;
};

export const isMarkerScore = (scoreA: unknown, scoreB: unknown): boolean =>
  (scoreA === WALKOVER_WIN_SCORE && scoreB === WALKOVER_LOSS_SCORE) ||
  (scoreA === WALKOVER_LOSS_SCORE && scoreB === WALKOVER_WIN_SCORE);

export const walkoverScores = (
  advanceA: boolean
): Pick<MatchScore, "scoreA" | "scoreB"> => ({
  scoreA: advanceA ? WALKOVER_WIN_SCORE : WALKOVER_LOSS_SCORE,
  scoreB: advanceA ? WALKOVER_LOSS_SCORE : WALKOVER_WIN_SCORE,
});

/**
 * Derive the authoritative result for a match from an input outcome. Scores
 * win over any supplied winner flag, so a stale/manual flag can never route a
 * different team than the one that actually scored more points.
 */
export const resolveEliminationResult = (
  match: EliminationMatch,
  input: EliminationResultInput
): ResolvedEliminationResult => {
  const resultType = input.resultType ?? "normal";
  const scoresProvided = input.scoreA !== undefined || input.scoreB !== undefined;
  const scoreA = scoresProvided ? input.scoreA ?? null : null;
  const scoreB = scoresProvided ? input.scoreB ?? null : null;
  const scoreWinnerId = deriveWinner(match.teamAId, match.teamBId, scoreA, scoreB);
  const winnerId = scoreWinnerId ?? input.winnerId ?? null;
  // When scores decide the result, derive the loser from the participants so
  // a supplied loser flag can never disagree. Legacy no-score outcomes keep
  // their supplied pair, which the caller still validates against the match.
  const loserId = scoreWinnerId
    ? scoreWinnerId === match.teamAId
      ? match.teamBId
      : match.teamAId
    : input.loserId ?? null;

  return { winnerId, loserId, scoreA, scoreB, resultType };
};

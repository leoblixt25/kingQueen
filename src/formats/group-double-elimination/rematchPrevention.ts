import type {
  BracketLink,
  EliminationBracket,
  EliminationMatch,
  MatchId,
  TeamId,
} from "./types";
import { getLoser, getWinner } from "./matchResult";
import {
  findEliminationMatch,
  listEliminationMatches,
  replaceEliminationMatch,
} from "./bracket";

/**
 * Deterministic immediate-rematch prevention for loser drops.
 *
 * The canonical bracket drops a Winners-bracket loser into the same-index
 * Losers match. That can recreate a Winners matchup in the next round (for
 * example, a team that beat another team in Winners Round 1 can meet it again
 * after both lose in Winners Round 2). When enabled, the drop is redirected to
 * a different Losers match in the same round whose waiting opponent has not
 * yet been played by the dropping team. If every alternative is a rematch,
 * the canonical link is kept so bracket progression is never blocked.
 */

export const getPlayedOpponents = (
  bracket: EliminationBracket,
  teamId: TeamId
): Set<TeamId> => {
  const opponents = new Set<TeamId>();

  for (const match of listEliminationMatches(bracket)) {
    if (match.status !== "completed") continue;

    const winner = getWinner(match);
    const loser = getLoser(match);
    if (winner === teamId && loser) {
      opponents.add(loser);
    }
    if (loser === teamId && winner) {
      opponents.add(winner);
    }
  }

  return opponents;
};

export const teamsHavePlayed = (
  bracket: EliminationBracket,
  teamAId: TeamId,
  teamBId: TeamId
): boolean => getPlayedOpponents(bracket, teamAId).has(teamBId);

const occupantOf = (match: EliminationMatch, slot: "teamA" | "teamB") =>
  slot === "teamA" ? match.teamAId : match.teamBId;

const slotIsEmpty = (match: EliminationMatch, slot: "teamA" | "teamB") =>
  occupantOf(match, slot) === null;

const otherSlot = (slot: "teamA" | "teamB"): "teamA" | "teamB" =>
  slot === "teamA" ? "teamB" : "teamA";

export interface RematchSafeDrop {
  /** The link actually used for the drop. */
  link: BracketLink;
  /** Bracket with the source match's `loserTo` updated when it was redirected. */
  bracket: EliminationBracket;
  /** True when a different target was chosen to avoid a rematch. */
  redirected: boolean;
}

/**
 * Chooses where a loser should drop, redirecting only when doing so both
 * avoids a rematch and preserves the round/structure of the bracket.
 */
export const chooseRematchSafeDrop = (
  bracket: EliminationBracket,
  sourceMatchId: MatchId,
  loserId: TeamId
): RematchSafeDrop => {
  const source = findEliminationMatch(bracket, sourceMatchId);
  const original = source?.loserTo;

  if (!source || !original) {
    return { link: original as BracketLink, bracket, redirected: false };
  }

  const originalTarget = findEliminationMatch(bracket, original.matchId);
  if (!originalTarget) {
    return { link: original, bracket, redirected: false };
  }

  const occupant = occupantOf(originalTarget, otherSlot(original.slot));
  const dropSlotTeam = occupantOf(originalTarget, original.slot);
  const played = getPlayedOpponents(bracket, loserId);

  // The canonical target must be redirected in two cases: it would recreate
  // an old matchup, or its drop slot has already been claimed by a different
  // loser (possible after an earlier redirect).
  const wouldRematch = occupant !== null && played.has(occupant);
  const alreadyClaimed = dropSlotTeam !== null && dropSlotTeam !== loserId;
  if (!wouldRematch && !alreadyClaimed) {
    return { link: original, bracket, redirected: false };
  }

  const candidates = bracket.losers
    .filter(
      (match) =>
        match.round === originalTarget.round &&
        match.id !== originalTarget.id &&
        match.status !== "completed" &&
        slotIsEmpty(match, original.slot) &&
        occupantOf(match, otherSlot(original.slot)) !== null &&
        !played.has(occupantOf(match, otherSlot(original.slot)) as TeamId)
    )
    .sort((a, b) => {
      const distanceA = Math.abs(a.index - originalTarget.index);
      const distanceB = Math.abs(b.index - originalTarget.index);
      return distanceA - distanceB || a.id.localeCompare(b.id);
    });

  const chosen = candidates[0];
  if (!chosen) {
    return { link: original, bracket, redirected: false };
  }

  const updated = replaceEliminationMatch(bracket, {
    ...source,
    loserTo: { matchId: chosen.id, slot: original.slot },
  });

  return {
    link: { matchId: chosen.id, slot: original.slot },
    bracket: updated,
    redirected: true,
  };
};

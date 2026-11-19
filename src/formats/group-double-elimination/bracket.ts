import type {
  BracketSide,
  BracketSlot,
  EliminationBracket,
  EliminationMatch,
  MatchId,
  TeamId,
} from "./types";
import { getLoser, getWinner } from "./matchResult";
import { EliminationError } from "./errors";

/**
 * Double-elimination bracket generation.
 *
 * The engine builds a canonical power-of-two bracket, then collapses every
 * match that cannot be played (one or two empty slots) into a pass-through.
 * That is how arbitrary team counts and byes are supported: a collapsed
 * match contributes its winner source to the next real match and never
 * produces a loser. Group-stage results are never read here; the caller
 * supplies the seed order only.
 */

export interface EliminationBracketPlan {
  bracket: EliminationBracket;
  seededTeamIds: TeamId[];
}

type RawSource =
  | { kind: "seed"; teamId: TeamId }
  | { kind: "winner"; matchId: MatchId }
  | { kind: "loser"; matchId: MatchId }
  | { kind: "empty" };

type ResolvedSource =
  | { kind: "team"; teamId: TeamId }
  | { kind: "winner"; matchId: MatchId }
  | { kind: "loser"; matchId: MatchId }
  | { kind: "empty" };

interface MatchSpec {
  id: MatchId;
  phase: BracketSide;
  round: number;
  index: number;
  slots: [RawSource, RawSource];
}

const EMPTY: ResolvedSource = { kind: "empty" };
const RAW_EMPTY: RawSource = { kind: "empty" };

export const GRAND_FINAL_ONE_ID = "grand-final-1";
export const GRAND_FINAL_TWO_ID = "grand-final-2";

export const winnerMatchId = (round: number, index: number): MatchId =>
  `winners-r${round}-m${index}`;

export const loserMatchId = (round: number, index: number): MatchId =>
  `losers-r${round}-m${index}`;

/** Smallest power of two that can host `teamCount` teams. */
export const nextBracketSize = (teamCount: number): number => {
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
};

/**
 * Classic bracket seed order.
 * 4 teams → 1,4,2,3; 8 teams → 1,8,4,5,2,7,3,6.
 * Seeds above the team count become byes, so the best seeds receive them.
 */
export const buildSeedOrder = (size: number): number[] => {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed) => [seed, next + 1 - seed]);
  }
  return order;
};

const assertSeeds = (seededTeamIds: readonly TeamId[]): void => {
  if (seededTeamIds.length < 2) {
    throw new EliminationError(
      "invalid-team-count",
      `Double elimination needs at least 2 teams, received ${seededTeamIds.length}.`
    );
  }

  const seen = new Set<TeamId>();
  for (const teamId of seededTeamIds) {
    if (!teamId || teamId.trim() === "") {
      throw new EliminationError(
        "invalid-team-count",
        "Every seeded team needs a non-empty id."
      );
    }
    if (seen.has(teamId)) {
      throw new EliminationError(
        "duplicate-team",
        `Team id "${teamId}" appears more than once.`
      );
    }
    seen.add(teamId);
  }
};

const seedSource = (
  seededTeamIds: readonly TeamId[],
  seedNumber: number
): RawSource =>
  seedNumber <= seededTeamIds.length
    ? { kind: "seed", teamId: seededTeamIds[seedNumber - 1] }
    : RAW_EMPTY;

const buildWinnersSpecs = (
  size: number,
  rounds: number,
  seededTeamIds: readonly TeamId[]
): MatchSpec[] => {
  const order = buildSeedOrder(size);
  const specs: MatchSpec[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    const count = size / 2 ** round;
    for (let index = 1; index <= count; index += 1) {
      const slots: [RawSource, RawSource] =
        round === 1
          ? [
              seedSource(seededTeamIds, order[(index - 1) * 2]),
              seedSource(seededTeamIds, order[(index - 1) * 2 + 1]),
            ]
          : [
              {
                kind: "winner",
                matchId: winnerMatchId(round - 1, (index - 1) * 2 + 1),
              },
              {
                kind: "winner",
                matchId: winnerMatchId(round - 1, (index - 1) * 2 + 2),
              },
            ];

      specs.push({
        id: winnerMatchId(round, index),
        phase: "winners",
        round,
        index,
        slots,
      });
    }
  }

  return specs;
};

/**
 * Losers bracket layout (2k - 2 rounds for a size of 2^k):
 * - round 1 pairs the Losers of Winners round 1;
 * - even rounds drop the Losers of Winners round `round / 2 + 1` in;
 * - odd rounds pair the previous Losers round.
 */
const buildLosersSpecs = (size: number, rounds: number): MatchSpec[] => {
  const specs: MatchSpec[] = [];
  if (rounds < 2) return specs;

  const totalRounds = 2 * rounds - 2;
  const counts = new Map<number, number>();
  const firstCount = size / 4;

  for (let index = 1; index <= firstCount; index += 1) {
    specs.push({
      id: loserMatchId(1, index),
      phase: "losers",
      round: 1,
      index,
      slots: [
        { kind: "loser", matchId: winnerMatchId(1, (index - 1) * 2 + 1) },
        { kind: "loser", matchId: winnerMatchId(1, (index - 1) * 2 + 2) },
      ],
    });
  }
  counts.set(1, firstCount);

  for (let round = 2; round <= totalRounds; round += 1) {
    const previous = counts.get(round - 1) ?? 0;

    if (round % 2 === 0) {
      const winnersRound = round / 2 + 1;
      const count = size / 2 ** winnersRound;

      for (let index = 1; index <= count; index += 1) {
        specs.push({
          id: loserMatchId(round, index),
          phase: "losers",
          round,
          index,
          slots: [
            { kind: "winner", matchId: loserMatchId(round - 1, index) },
            { kind: "loser", matchId: winnerMatchId(winnersRound, index) },
          ],
        });
      }
      counts.set(round, count);
    } else {
      const count = previous / 2;

      for (let index = 1; index <= count; index += 1) {
        specs.push({
          id: loserMatchId(round, index),
          phase: "losers",
          round,
          index,
          slots: [
            {
              kind: "winner",
              matchId: loserMatchId(round - 1, (index - 1) * 2 + 1),
            },
            {
              kind: "winner",
              matchId: loserMatchId(round - 1, (index - 1) * 2 + 2),
            },
          ],
        });
      }
      counts.set(round, count);
    }
  }

  return specs;
};

const resolveRaw = (
  raw: RawSource,
  winners: Map<MatchId, ResolvedSource>,
  losers: Map<MatchId, ResolvedSource>
): ResolvedSource => {
  switch (raw.kind) {
    case "seed":
      return { kind: "team", teamId: raw.teamId };
    case "winner":
      return winners.get(raw.matchId) ?? EMPTY;
    case "loser":
      return losers.get(raw.matchId) ?? EMPTY;
    default:
      return EMPTY;
  }
};

export const generateDoubleEliminationBracket = (
  seededTeamIds: readonly TeamId[]
): EliminationBracketPlan => {
  assertSeeds(seededTeamIds);

  const seeds = [...seededTeamIds];
  const size = nextBracketSize(seeds.length);
  const rounds = Math.log2(size);

  const specs: MatchSpec[] = [
    ...buildWinnersSpecs(size, rounds, seeds),
    ...buildLosersSpecs(size, rounds),
  ];

  const losersChampion: RawSource =
    rounds >= 2
      ? { kind: "winner", matchId: loserMatchId(2 * rounds - 2, 1) }
      : { kind: "loser", matchId: winnerMatchId(1, 1) };

  specs.push({
    id: GRAND_FINAL_ONE_ID,
    phase: "grand-final",
    round: 1,
    index: 1,
    slots: [
      { kind: "winner", matchId: winnerMatchId(rounds, 1) },
      losersChampion,
    ],
  });

  const winnerByMatch = new Map<MatchId, ResolvedSource>();
  const loserByMatch = new Map<MatchId, ResolvedSource>();
  const matches = new Map<MatchId, EliminationMatch>();

  for (const spec of specs) {
    const slotA = resolveRaw(spec.slots[0], winnerByMatch, loserByMatch);
    const slotB = resolveRaw(spec.slots[1], winnerByMatch, loserByMatch);

    if (slotA.kind === "empty" && slotB.kind === "empty") {
      winnerByMatch.set(spec.id, EMPTY);
      loserByMatch.set(spec.id, EMPTY);
      continue;
    }

    if (slotA.kind === "empty" || slotB.kind === "empty") {
      winnerByMatch.set(
        spec.id,
        slotA.kind === "empty" ? slotB : slotA
      );
      loserByMatch.set(spec.id, EMPTY);
      continue;
    }

    const teamAId = slotA.kind === "team" ? slotA.teamId : null;
    const teamBId = slotB.kind === "team" ? slotB.teamId : null;

    matches.set(spec.id, {
      id: spec.id,
      phase: spec.phase,
      round: spec.round,
      index: spec.index,
      teamAId,
      teamBId,
      scoreA: null,
      scoreB: null,
      status: teamAId !== null && teamBId !== null ? "ready" : "pending",
      winnerId: null,
      loserId: null,
      winnerTo: null,
      loserTo: null,
    });

    winnerByMatch.set(spec.id, { kind: "winner", matchId: spec.id });
    loserByMatch.set(spec.id, { kind: "loser", matchId: spec.id });
  }

  const linkSource = (
    target: EliminationMatch,
    source: ResolvedSource,
    slot: BracketSlot
  ): void => {
    if (source.kind === "winner") {
      const from = matches.get(source.matchId);
      if (from) from.winnerTo = { matchId: target.id, slot };
    } else if (source.kind === "loser") {
      const from = matches.get(source.matchId);
      if (from) from.loserTo = { matchId: target.id, slot };
    }
  };

  for (const spec of specs) {
    const target = matches.get(spec.id);
    if (!target) continue;

    linkSource(
      target,
      resolveRaw(spec.slots[0], winnerByMatch, loserByMatch),
      "teamA"
    );
    linkSource(
      target,
      resolveRaw(spec.slots[1], winnerByMatch, loserByMatch),
      "teamB"
    );
  }

  const collect = (phase: BracketSide): EliminationMatch[] =>
    specs
      .filter((spec) => spec.phase === phase)
      .map((spec) => matches.get(spec.id))
      .filter((match): match is EliminationMatch => Boolean(match));

  const winners = collect("winners");
  const losers = collect("losers");
  const grandFinal = collect("grand-final");

  if (grandFinal.length === 0) {
    throw new EliminationError(
      "invalid-bracket",
      "Bracket generation produced no Grand Final."
    );
  }

  const roundOneTeams = new Set<TeamId>();
  for (const match of winners) {
    if (match.round !== 1) continue;
    if (match.teamAId) roundOneTeams.add(match.teamAId);
    if (match.teamBId) roundOneTeams.add(match.teamBId);
  }

  return {
    bracket: {
      winners,
      losers,
      grandFinal,
      resetFinalRequired: false,
      seededTeamIds: seeds,
      bracketSize: size,
      byeTeamIds: seeds.filter((teamId) => !roundOneTeams.has(teamId)),
    },
    seededTeamIds: seeds,
  };
};

export const listEliminationMatches = (
  bracket: EliminationBracket
): EliminationMatch[] => [
  ...bracket.winners,
  ...bracket.losers,
  ...bracket.grandFinal,
];

export const findEliminationMatch = (
  bracket: EliminationBracket,
  matchId: MatchId
): EliminationMatch | undefined =>
  listEliminationMatches(bracket).find((match) => match.id === matchId);

/** Replaces one match in its bracket array, leaving the rest untouched. */
export const replaceEliminationMatch = (
  bracket: EliminationBracket,
  updated: EliminationMatch
): EliminationBracket => {
  const swap = (matches: EliminationMatch[]): EliminationMatch[] =>
    matches.map((match) => (match.id === updated.id ? updated : match));

  return {
    ...bracket,
    winners: swap(bracket.winners),
    losers: swap(bracket.losers),
    grandFinal: swap(bracket.grandFinal),
  };
};

export const validateEliminationBracket = (
  bracket: EliminationBracket
): string[] => {
  const problems: string[] = [];
  const all = listEliminationMatches(bracket);
  const byId = new Map<MatchId, EliminationMatch>();

  for (const match of all) {
    if (byId.has(match.id)) {
      problems.push(`Duplicate match id "${match.id}".`);
    }
    byId.set(match.id, match);
  }

  if (bracket.grandFinal.length === 0) {
    problems.push("Bracket has no Grand Final.");
  }

  for (const match of all) {
    if (match.teamAId !== null && match.teamAId === match.teamBId) {
      problems.push(`"${match.id}" has the same team on both sides.`);
    }

    if (match.status !== "completed") continue;

    const winner = getWinner(match);
    const loser = getLoser(match);
    if (!winner || !loser) {
      problems.push(`"${match.id}" is completed without a winner and loser.`);
      continue;
    }

    const participants = [match.teamAId, match.teamBId];
    if (!participants.includes(winner)) {
      problems.push(`"${match.id}" winner is not a participant.`);
    }
    if (!participants.includes(loser)) {
      problems.push(`"${match.id}" loser is not a participant.`);
    }
    if (winner === loser) {
      problems.push(`"${match.id}" cannot have the same winner and loser.`);
    }
  }

  const claimed = new Map<string, MatchId>();
  for (const match of all) {
    for (const link of [match.winnerTo, match.loserTo]) {
      if (!link) continue;

      if (!byId.has(link.matchId)) {
        problems.push(
          `"${match.id}" links to unknown match "${link.matchId}".`
        );
        continue;
      }

      const key = `${link.matchId}:${link.slot}`;
      const existing = claimed.get(key);
      if (existing) {
        problems.push(
          `Slot ${key} is fed by both "${existing}" and "${match.id}".`
        );
      }
      claimed.set(key, match.id);
    }
  }

  return problems;
};

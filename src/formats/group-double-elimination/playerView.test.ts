import { describe, expect, it } from "vitest";
import type { Team, TeamId } from "./types";
import { createGsdeTournamentDocument } from "./persistence";
import {
  buildTeamsAndGroups,
  generateEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
  startGroupStage,
} from "./scoring";
import { listEliminationMatches } from "./bracket";
import {
  buildPlayerEliminationView,
  buildPlayerGroupView,
  buildPlayerView,
  getPlayerStage,
} from "./playerView";

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

/** Every group match is scored so `loseTeamId` loses all three of its games. */
const readyWithWinlessTeam = (loseTeamId: TeamId) => {
  let doc = startGroupStage(
    buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams())
  );
  for (const match of [...doc.matches]) {
    const loses = match.teamAId === loseTeamId || match.teamBId === loseTeamId;
    const aWins = loses ? match.teamBId === loseTeamId : true;
    doc = scoreGroupMatch(doc, match.id, aWins ? 21 : 10, aWins ? 10 : 21);
  }
  return doc;
};

type ReadyDoc = ReturnType<typeof readyWithWinlessTeam>;

const loseNextEliminationMatch = (
  doc: ReadyDoc,
  teamId: TeamId,
  guard = 0
): ReadyDoc => {
  if (guard > 40) throw new Error(`No playable elimination match for ${teamId}`);
  const playable = listEliminationMatches(doc.elimination!)
    .filter(
      (item) =>
        item.status !== "completed" &&
        item.teamAId !== null &&
        item.teamBId !== null
    )
    .sort((a, b) => a.round - b.round || a.index - b.index);

  const match = playable.find(
    (item) => item.teamAId === teamId || item.teamBId === teamId
  );
  if (!match) {
    // The team's next opponent is still TBD: complete the earliest other
    // match so the bracket can feed that slot, then try again.
    const feeder = playable[0];
    if (!feeder) throw new Error(`No playable elimination match for ${teamId}`);
    const next = scoreEliminationMatch(doc, {
      matchId: feeder.id,
      winnerId: feeder.teamAId!,
      loserId: feeder.teamBId!,
    });
    return loseNextEliminationMatch(next, teamId, guard + 1);
  }

  const winnerId = match.teamAId === teamId ? match.teamBId! : match.teamAId!;
  return scoreEliminationMatch(doc, {
    matchId: match.id,
    winnerId,
    loserId: teamId,
  });
};

const WINLESS = "t16";

describe("player group-stage view", () => {
  it("reports the assigned group, opponents, results, ranking and group losses", () => {
    const doc = readyWithWinlessTeam(WINLESS);
    const view = buildPlayerGroupView(doc, WINLESS);

    expect(view).not.toBeNull();
    expect(view!.opponents).toHaveLength(3);
    expect(view!.results).toHaveLength(3);
    expect(view!.upcoming).toHaveLength(0);
    expect(view!.results.every((match) => !match.won)).toBe(true);
    expect(view!.standing?.rank).toBe(4);
    expect(view!.groupLosses).toBe(3);
  });

  it("lists upcoming matches before they are played", () => {
    let doc = startGroupStage(
      buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams())
    );
    const first = doc.matches[0];
    doc = scoreGroupMatch(doc, first.id, 21, 10);

    const view = buildPlayerGroupView(doc, first.teamBId);
    expect(view!.upcoming.some((match) => match.matchId === first.id)).toBe(false);
    expect(view!.upcoming.length).toBeGreaterThan(0);
    expect(view!.results).toHaveLength(1);
  });
});

describe("player elimination view", () => {
  it("shows ZERO elimination losses at bracket entry despite three group losses", () => {
    const doc = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    const group = buildPlayerGroupView(doc, WINLESS);
    const elimination = buildPlayerEliminationView(doc, WINLESS);

    expect(group!.groupLosses).toBe(3);
    expect(elimination!.eliminationLosses).toBe(0);
    expect(elimination!.status).toBe("winners");
    expect(elimination!.competing).toBe(true);
    expect(elimination!.matches.length).toBeGreaterThan(0);
  });

  it("moves to the Losers bracket after the first elimination loss", () => {
    let doc = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    doc = loseNextEliminationMatch(doc, WINLESS);
    const view = buildPlayerEliminationView(doc, WINLESS);

    expect(view!.eliminationLosses).toBe(1);
    expect(view!.status).toBe("losers");
    expect(view!.competing).toBe(true);
  });

  it("is eliminated after the second elimination loss", () => {
    let doc = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    doc = loseNextEliminationMatch(doc, WINLESS);
    doc = loseNextEliminationMatch(doc, WINLESS);
    const view = buildPlayerEliminationView(doc, WINLESS);

    expect(view!.eliminationLosses).toBe(2);
    expect(view!.status).toBe("eliminated");
    expect(view!.competing).toBe(false);
    expect(view!.eliminatedByMatchId).not.toBeNull();
  });

  it("exposes the next opponent and schedule from game numbers", () => {
    const doc = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    const view = buildPlayerEliminationView(doc, WINLESS);

    expect(view!.nextMatch).not.toBeNull();
    expect(view!.nextMatch!.gameNumber).not.toBeNull();
    expect(view!.matches.every((match) => match.gameNumber !== null)).toBe(true);
  });
});

describe("stage-dependent combined view", () => {
  it("advances registration → group-stage → elimination using authoritative data", () => {
    const initial = createGsdeTournamentDocument("event-1");
    const withTeams = { ...initial, teams: makeTeams() };
    expect(getPlayerStage(withTeams)).toBe("registration");

    const grouped = buildTeamsAndGroups(withTeams, withTeams.teams);
    expect(getPlayerStage(grouped)).toBe("group-stage");

    const ready = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    expect(getPlayerStage(ready)).toBe("elimination");

    const view = buildPlayerView(ready, WINLESS);
    expect(view!.stage).toBe("elimination");
    expect(view!.teamName).toBe("Team 16");
    expect(view!.group!.groupLosses).toBe(3);
    expect(view!.elimination!.eliminationLosses).toBe(0);
  });

  it("returns null for an unknown team", () => {
    const doc = generateEliminationBracket(readyWithWinlessTeam(WINLESS));
    expect(buildPlayerView(doc, "unknown")).toBeNull();
  });
});

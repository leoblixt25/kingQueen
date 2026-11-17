import { describe, expect, it } from "vitest";
import type { Team } from "./types";
import {
  createGsdeTournamentDocument,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  buildTeamsAndGroups,
  correctGroupMatchScore,
  generateEliminationBracket,
  resetEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
} from "./scoring";
import { listEliminationMatches } from "./bracket";
import {
  ELIMINATION_RANKING_SYSTEM,
  GROUP_RANKING_SYSTEM,
  selectEliminationRecord,
  selectGroupRecord,
  selectRankingSystems,
} from "./rankingSystems";

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const ready = () =>
  buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams());

const playAllGroups = (): GsdeTournamentDocument => {
  let doc = ready();
  for (const match of [...doc.matches]) {
    doc = scoreGroupMatch(doc, match.id, 21, 10);
  }
  return doc;
};

const playFirstEliminationMatch = (doc: GsdeTournamentDocument) => {
  if (!doc.elimination) throw new Error("No elimination bracket");
  const match = listEliminationMatches(doc.elimination)[0];
  return scoreEliminationMatch(doc, {
    matchId: match.id,
    winnerId: match.teamAId!,
    loserId: match.teamBId!,
  });
};

describe("independent ranking systems", () => {
  it("exposes distinct definitions with no combined ranking", () => {
    const systems = selectRankingSystems(playAllGroups());
    expect(systems.group.definition).toBe(GROUP_RANKING_SYSTEM);
    expect(systems.elimination.definition).toBe(ELIMINATION_RANKING_SYSTEM);
    expect(Object.keys(systems).sort()).toEqual(["elimination", "group"]);
  });

  it("derives group standings only from group matches", () => {
    let doc = playAllGroups();
    const before = selectRankingSystems(doc);
    const target = doc.matches[0];
    doc = correctGroupMatchScore(doc, target.id, 10, 21);
    const after = selectRankingSystems(doc);

    expect(after.group.global).not.toEqual(before.group.global);
    expect(after.group.tables).not.toEqual(before.group.tables);
    expect(selectGroupRecord(doc, target.teamAId).losses).toBe(1);
  });

  it("does not put group wins or losses into elimination standings", () => {
    const doc = playAllGroups();
    const systems = selectRankingSystems(doc);

    expect(systems.elimination.standings).toHaveLength(0);
    expect(systems.elimination.placements).toHaveLength(0);
    expect(systems.elimination.championTeamId).toBeNull();

    const groupTotals = systems.group.global.reduce(
      (sum, row) => sum + row.wins + row.losses,
      0
    );
    expect(groupTotals).toBe(24 * 2);
  });

  it("elimination results change elimination rankings only", () => {
    let doc = generateEliminationBracket(playAllGroups());
    const before = selectRankingSystems(doc);
    doc = playFirstEliminationMatch(doc);
    const after = selectRankingSystems(doc);

    expect(after.group).toEqual(before.group);
    expect(after.elimination.standings).not.toEqual(before.elimination.standings);
    expect(after.elimination.standings.some((row) => row.wins === 1)).toBe(true);
    expect(after.elimination.standings.some((row) => row.losses === 1)).toBe(true);
  });

  it("group corrections only rebuild the group system, never carry results over", () => {
    let doc = generateEliminationBracket(playAllGroups());
    const before = selectRankingSystems(doc);
    doc = resetEliminationBracket(doc);
    const target = doc.matches[0];
    doc = correctGroupMatchScore(doc, target.id, 10, 21);
    const regenerated = selectRankingSystems(generateEliminationBracket(doc));

    expect(regenerated.group.global).not.toEqual(before.group.global);
    expect(selectGroupRecord(doc, target.teamAId).losses).toBe(1);
    expect(
      regenerated.elimination.standings.every(
        (row) => row.wins === 0 && row.losses === 0
      )
    ).toBe(true);
  });

  it("exposes separate per-team records with no shared total", () => {
    const doc = generateEliminationBracket(playAllGroups());
    const teamId = doc.teams[0].id;
    const group = selectGroupRecord(doc, teamId);
    const elimination = selectEliminationRecord(doc, teamId);

    expect(group.wins + group.losses).toBe(3);
    expect(elimination).toEqual({ wins: 0, losses: 0 });
    expect(selectGroupRecord(doc, "unknown")).toEqual({ wins: 0, losses: 0 });
    expect(selectEliminationRecord(doc, "unknown")).toEqual({ wins: 0, losses: 0 });
  });
});

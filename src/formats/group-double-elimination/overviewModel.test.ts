import { describe, expect, it } from "vitest";
import { UNKNOWN_ADMIN } from "./audit";
import { createGsdeTournamentDocument } from "./persistence";
import { getRegisteredTeamId } from "./registration";
import {
  loadTestTeamsAndPlayers,
  testPlayerUid,
} from "./testData";
import {
  selectFinalResult,
  selectGlobalRanking,
  selectGroupStandings,
} from "./scoring";
import {
  buildGsdeOverviewModel,
  resolveOverviewViewerTeamId,
} from "./overviewModel";

const deterministicRng = () => {
  let state = 20261121;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

const completedDoc = () =>
  loadTestTeamsAndPlayers(createGsdeTournamentDocument("overview-test"), UNKNOWN_ADMIN, {
    results: "full",
    rng: deterministicRng(),
  });

describe("tournament overview view model", () => {
  it("uses the engine standings for every group row", () => {
    const doc = completedDoc();
    const model = buildGsdeOverviewModel(doc);
    const tables = selectGroupStandings(doc);

    expect(model.groups.map((group) => group.name)).toEqual([
      "Group A",
      "Group B",
      "Group C",
      "Group D",
    ]);
    expect(model.leftGroups.map((group) => group.name)).toEqual([
      "Group A",
      "Group B",
    ]);
    expect(model.rightGroups.map((group) => group.name)).toEqual([
      "Group C",
      "Group D",
    ]);
    expect(model.qualifiedCount).toBe(16);
    expect(model.advanceAllTeams).toBe(true);

    model.groups.forEach((group, groupIndex) => {
      const table = tables[groupIndex];
      expect(group.id).toBe(table.groupId);
      group.teams.forEach((team, teamIndex) => {
        const row = table.rows[teamIndex];
        expect(team.id).toBe(row.teamId);
        expect(team.rank).toBe(row.rank);
        expect(team.played).toBe(row.played);
        expect(team.wins).toBe(row.wins);
        expect(team.losses).toBe(row.losses);
        expect(team.pointsFor).toBe(row.pointsFor);
        expect(team.pointsAgainst).toBe(row.pointsAgainst);
        expect(team.pointDifference).toBe(row.pointDifference);
        expect(team.qualified).toBe(row.qualified);
        expect(team.isLeader).toBe(row.rank === 1);
        expect(team.players).toHaveLength(2);
        expect(team.name).toContain(team.players[0]);
      });
    });
  });

  it("projects the canonical bracket rounds, links and final", () => {
    const doc = completedDoc();
    const model = buildGsdeOverviewModel(doc);

    expect(model.bracketGenerated).toBe(true);
    expect(model.winnersRounds.map((round) => round.label)).toEqual([
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Winners Final",
    ]);
    expect(model.winnersRounds.flatMap((round) => round.matches)).toHaveLength(15);
    expect(model.losersRounds).toHaveLength(6);
    expect(model.losersRounds.at(-1)?.label).toBe("Losers Final");
    expect(model.grandFinal.matches[0]?.gameLabel).toBe("Game 30");
    expect(model.grandFinal.winnersChampionId).not.toBeNull();
    expect(model.grandFinal.losersChampionId).not.toBeNull();
    expect(model.grandFinal.championTeamIds).toEqual(
      selectFinalResult(doc).championTeamIds
    );
    expect(model.grandFinal.complete).toBe(true);

    const firstMatch = model.winnersRounds[0].matches[0];
    expect(firstMatch.gameLabel).toBe("Game 1");
    expect(firstMatch.winnerTo).toMatch(/^Game /);
    expect(firstMatch.loserTo).toMatch(/^Game /);
  });

  it("maps each seeded team to its stored bracket entry game", () => {
    const doc = completedDoc();
    const model = buildGsdeOverviewModel(doc);
    const firstMatch = doc.elimination?.winners.find(
      (match) => match.round === 1 && match.index === 1
    );
    const teamId = firstMatch?.teamAId;
    const row = model.groups
      .flatMap((group) => group.teams)
      .find((team) => team.id === teamId);

    expect(teamId).toBeTruthy();
    expect(row?.entryGame).toBe("Game 1");
    expect(row?.entryRound).toBe("Round of 16");
    expect(row?.globalRank).toBe(
      selectGlobalRanking(doc).find((entry) => entry.teamId === teamId)?.globalRank
    );
  });

  it("highlights only the signed-in player's team", () => {
    const doc = completedDoc();
    const uid = testPlayerUid(0);
    const teamId = getRegisteredTeamId(doc, uid);
    expect(teamId).toBeTruthy();

    const model = buildGsdeOverviewModel(doc, teamId);
    const highlighted = model.groups
      .flatMap((group) => group.teams)
      .filter((team) => team.isViewerTeam);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe(teamId);
    expect(buildGsdeOverviewModel(doc, "not-a-team").groups.flatMap((group) => group.teams).some((team) => team.isViewerTeam)).toBe(false);
  });

  it("resolves the viewer through the existing approved-registration rules", () => {
    const doc = completedDoc();
    const uid = testPlayerUid(0);
    const expected = getRegisteredTeamId(doc, uid);
    expect(resolveOverviewViewerTeamId(doc, uid, undefined)).toBe(expected);
    expect(resolveOverviewViewerTeamId(doc, null, undefined)).toBeNull();
    expect(resolveOverviewViewerTeamId(doc, "missing-uid", "nobody@example.com")).toBeNull();
  });

  it("renders an empty bracket before elimination is generated", () => {
    const model = buildGsdeOverviewModel(createGsdeTournamentDocument("empty"));
    expect(model.bracketGenerated).toBe(false);
    expect(model.winnersRounds).toEqual([]);
    expect(model.losersRounds).toEqual([]);
    expect(model.grandFinal.matches).toEqual([]);
    expect(model.groups).toEqual([]);
  });
});

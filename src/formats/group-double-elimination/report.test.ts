import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import { appendAudit } from "./audit";
import { createGsdeTournamentDocument } from "./persistence";
import { buildGsdeTournamentReport } from "./report";
import { loadTestTeamsAndPlayers } from "./testData";
import type { GsdeTournamentDocument } from "./persistence";

const ADMIN: AuditActor = {
  id: "admin-1",
  label: "admin@kingqueen.test",
  isAdmin: true,
};

const seededRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const makeDoc = (
  category: GsdeTournamentDocument["tournament"]["config"]["category"] = "Mixto"
): GsdeTournamentDocument => ({
  ...createGsdeTournamentDocument("report1"),
  tournament: {
    ...createGsdeTournamentDocument("report1").tournament,
    config: {
      ...createGsdeTournamentDocument("report1").tournament.config,
      name: "European Cup",
      date: "2026-11-19",
      teamLimit: 8,
      category,
      groupCount: 2,
      teamsPerGroup: 4,
    },
  },
});

describe("buildGsdeTournamentReport", () => {
  it("builds an empty but valid report for a new tournament", () => {
    const report = buildGsdeTournamentReport(makeDoc(), {
      generatedAt: "2026-11-19T10:00:00.000Z",
    });

    expect(report.id).toBe("report1");
    expect(report.title).toBe("European Cup");
    expect(report.category).toBe("Mixto");
    expect(report.date).toBe("2026-11-19");
    expect(report.generatedAt).toBe("2026-11-19T10:00:00.000Z");
    expect(report.counts).toEqual({
      teams: 0,
      players: 0,
      groups: 0,
      groupMatchesCompleted: 0,
      groupMatchesTotal: 0,
      eliminationMatchesCompleted: 0,
      eliminationMatchesTotal: 0,
    });
    expect(report.groups).toEqual([]);
    expect(report.finalPlacements).toEqual([]);
  });

  it("includes every group, ranking, result and placement from a completed tournament", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(), ADMIN, {
      results: "full",
      rng: seededRng(19),
    });
    const report = buildGsdeTournamentReport(loaded, {
      generatedAt: "2026-11-19T10:00:00.000Z",
    });

    expect(report.counts.teams).toBe(8);
    expect(report.counts.players).toBe(16);
    expect(report.counts.groups).toBe(2);
    expect(report.counts.groupMatchesCompleted).toBe(12);
    expect(report.counts.groupMatchesTotal).toBe(12);
    expect(report.counts.eliminationMatchesCompleted).toBeGreaterThan(0);
    expect(report.groups).toHaveLength(2);
    expect(report.groups.flatMap((group) => group.standings)).toHaveLength(8);
    expect(report.groups.flatMap((group) => group.results)).toHaveLength(12);
    expect(report.globalRanking).toHaveLength(8);
    expect(report.eliminationStandings).toHaveLength(8);
    expect(report.complete).toBe(true);
    expect(report.champions).toHaveLength(1);
    expect(report.runnersUp).toHaveLength(1);
    expect(report.finalPlacements.length).toBeGreaterThan(0);
    expect(report.finalPlacements[0].teams).toEqual(report.champions);

    const scores = [
      ...report.groups.flatMap((group) => group.results),
      ...report.eliminationMatches,
    ];
    expect(scores.every((match) => match.status === "completed")).toBe(true);
    scores.forEach((match) => {
      const winnerScore = match.winnerId === match.teamAId ? match.scoreA : match.scoreB;
      const loserScore = match.winnerId === match.teamAId ? match.scoreB : match.scoreA;
      expect(winnerScore).toBe(21);
      expect(loserScore).toBeLessThanOrEqual(20);
    });
  });

  it("uses the pair names and preserves custom team names", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(), ADMIN);
    const custom = {
      ...loaded,
      teams: loaded.teams.map((team, index) =>
        index === 0
          ? { ...team, name: "Dream Team", nameIsCustom: true }
          : team
      ),
    };
    const report = buildGsdeTournamentReport(custom);

    expect(report.teams[0].name).toMatch(/^Dream Team \(.+\/ .+\)$/);
    expect(report.teams[0].players).toHaveLength(2);
    expect(report.players).toHaveLength(16);
    expect(report.players.every((player) => player.gender !== null)).toBe(true);
  });

  it("includes the audit corrections in the export", () => {
    const loaded = appendAudit(makeDoc(), {
      action: "group-score-corrected",
      actor: ADMIN,
      matchId: "g1-r1-m1",
      detail: "Changed 18-21 to 21-14.",
    });
    const report = buildGsdeTournamentReport(loaded);

    expect(report.corrections).toHaveLength(1);
    expect(report.corrections[0].action).toBe("Group Score Corrected");
    expect(report.corrections[0].actor).toBe(ADMIN.label);
    expect(report.corrections[0].detail).toContain("21-14");
  });
});

import { describe, expect, it } from "vitest";
import type { AuditActor } from "@/formats/group-double-elimination/audit";
import { generateEliminationBracket } from "@/formats/group-double-elimination/scoring";
import { createGsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import { buildGsdeTournamentReport } from "@/formats/group-double-elimination/report";
import { loadTestTeamsAndPlayers } from "@/formats/group-double-elimination/testData";
import {
  buildBracketRounds,
  buildGsdePdf,
  groupAuditEntries,
} from "./gsdePdfExport";

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

const baseTemplate = () => {
  const template = createGsdeTournamentDocument("pdf-smoke");
  return {
    ...template,
    tournament: {
      ...template.tournament,
      config: {
        ...template.tournament.config,
        name: "PDF Smoke Cup",
        date: "2026-11-19",
        teamLimit: 16,
        groupCount: 4,
        teamsPerGroup: 4,
      },
    },
  };
};

const completeReport = () =>
  buildGsdeTournamentReport(
    loadTestTeamsAndPlayers(baseTemplate(), ADMIN, {
      results: "full",
      rng: seededRng(11),
    }),
    { generatedAt: "2026-11-19T10:00:00.000Z" }
  );

const pdfText = (pdf: ReturnType<typeof buildGsdePdf>): string =>
  pdf.output() as string;

describe("buildGsdePdf", () => {
  it("renders every section of a completed GSDE tournament", () => {
    const pdf = buildGsdePdf(completeReport());

    expect(pdf.getNumberOfPages()).toBeGreaterThan(4);
    expect(pdf.output("arraybuffer")).toBeInstanceOf(ArrayBuffer);
    const text = pdfText(pdf);
    expect(text).toContain("(Tournament Overview) Tj");
    expect(text).toContain("(Winners Bracket) Tj");
    expect(text).toContain("(Losers Bracket) Tj");
    expect(text).toContain("(Final Placements) Tj");
    expect(text).toContain("(Elimination Status) Tj");
    expect(text).toContain("(Result status) Tj");
  });

  it("renders an empty tournament without throwing", () => {
    const report = buildGsdeTournamentReport(
      createGsdeTournamentDocument("pdf-empty")
    );
    const pdf = buildGsdePdf(report);

    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output("arraybuffer")).toBeInstanceOf(ArrayBuffer);
  });

  it("shows the big banner on page 1 only and pages have running headers/footers", () => {
    const text = pdfText(buildGsdePdf(completeReport()));

    // The banner subtitle is drawn once, on page 1, never in running headers.
    expect(text.match(/\(Group Stage \+ Double Elimination\) Tj/g)).toHaveLength(1);
    expect(text).toContain("(Page 1 of ");
    expect(text).toContain("|  Generated 2026-11-19) Tj");
  });

  it("shows TBD cards instead of empty slots for an unplayed bracket", () => {
    const groupsOnly = loadTestTeamsAndPlayers(baseTemplate(), ADMIN, {
      results: "groups",
      rng: seededRng(7),
    });
    const withBracket = generateEliminationBracket(groupsOnly, {}, ADMIN);
    const report = buildGsdeTournamentReport(withBracket, {
      generatedAt: "2026-11-19T10:00:00.000Z",
    });
    const pdf = buildGsdePdf(report);

    expect(pdf.getNumberOfPages()).toBeGreaterThan(4);
    expect(pdfText(pdf)).toContain("(TBD) Tj");
  });

  it("separates a custom team name from its two players in the teams table", () => {
    const tournament = loadTestTeamsAndPlayers(baseTemplate(), ADMIN, {
      results: "groups",
      rng: seededRng(3),
    });
    const firstTeam = tournament.teams[0];
    const custom = {
      ...tournament,
      teams: tournament.teams.map((team) =>
        team.id === firstTeam.id
          ? { ...team, name: "Thunderbolts", nameIsCustom: true }
          : team
      ),
    };
    const pdf = buildGsdePdf(buildGsdeTournamentReport(custom));
    const text = pdfText(pdf);

    // Teams table shows the custom name alone; the resolved name (with players)
    // still appears in standings/results.
    expect(text).toContain("(Thunderbolts) Tj");
    expect(text).toContain("(Players) Tj");
  });

  it("adds a grouped audit page only when requested", () => {
    const report = completeReport();
    const repeated = Array.from({ length: 5 }, () => ({
      at: "2026-11-19T10:00:00.000Z",
      action: "Score Corrected",
      actor: "admin@kingqueen.test",
      matchId: "winners-r1-m6",
      detail: "winner changed",
    }));
    const withAudit = {
      ...report,
      corrections: [...report.corrections, ...repeated],
    };

    const without = buildGsdePdf(report);
    const withLog = buildGsdePdf(withAudit, { includeAuditLog: true });
    expect(withLog.getNumberOfPages()).toBe(without.getNumberOfPages() + 1);
    expect(pdfText(withLog)).toContain("(x5) Tj");
    expect(pdfText(without)).not.toContain("(x5) Tj");
  });
});

describe("PDF layout helpers", () => {
  it("orders bracket rounds by the published game numbers", () => {
    const winners = completeReport().eliminationMatches.filter(
      (match) => match.phase === "winners"
    );
    const rounds = buildBracketRounds(winners, "winners");
    expect(rounds.map((round) => round.key)).toEqual(["wr1", "wr2", "wr3", "wr4"]);
    expect(rounds[0].title).toBe("R1");
    expect(rounds[0].range).toBe("Games 1-8");
    expect(rounds[2].title).toBe("Semifinals");
    expect(rounds[3].title).toBe("Final");
  });

  it("collapses repeated audit entries into one counted line", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      at: `2026-11-19T10:00:0${index}.000Z`,
      action: "Score Corrected",
      actor: "admin@kingqueen.test",
      matchId: "winners-r1-m6",
      detail: "winner changed",
    }));
    const groups = groupAuditEntries(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(5);
    expect(groups[0].matchId).toBe("winners-r1-m6");
  });
});

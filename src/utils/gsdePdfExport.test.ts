import { describe, expect, it } from "vitest";
import type { AuditActor } from "@/formats/group-double-elimination/audit";
import { createGsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import { buildGsdeTournamentReport } from "@/formats/group-double-elimination/report";
import { loadTestTeamsAndPlayers } from "@/formats/group-double-elimination/testData";
import { buildGsdePdf } from "./gsdePdfExport";

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

describe("buildGsdePdf", () => {
  it("renders every section of a completed GSDE tournament", () => {
    const template = createGsdeTournamentDocument("pdf-smoke");
    const tournament = loadTestTeamsAndPlayers(
      {
        ...template,
        tournament: {
          ...template.tournament,
          config: {
            ...template.tournament.config,
            name: "PDF Smoke Cup",
            date: "2026-11-19",
            teamLimit: 8,
            groupCount: 2,
            teamsPerGroup: 4,
          },
        },
      },
      ADMIN,
      { results: "full", rng: seededRng(11) }
    );

    const report = buildGsdeTournamentReport(tournament, {
      generatedAt: "2026-11-19T10:00:00.000Z",
    });
    const pdf = buildGsdePdf(report);

    expect(pdf.getNumberOfPages()).toBeGreaterThan(4);
    expect(pdf.output("arraybuffer")).toBeInstanceOf(ArrayBuffer);
  });

  it("renders an empty tournament without throwing", () => {
    const report = buildGsdeTournamentReport(
      createGsdeTournamentDocument("pdf-empty")
    );
    const pdf = buildGsdePdf(report);

    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output("arraybuffer")).toBeInstanceOf(ArrayBuffer);
  });
});

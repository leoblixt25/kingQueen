import { describe, expect, it } from "vitest";
import {
  GROUP_DOUBLE_ELIMINATION_FORMAT,
  KING_QUEEN_FORMAT,
  TOURNAMENT_FORMAT_DEFINITIONS,
  getTournamentFormatDefinition,
} from "./registry";
import { TOURNAMENT_FORMAT_IDS, isTournamentFormat } from "./types";

describe("tournament format registry", () => {
  it("registers both supported formats", () => {
    expect(TOURNAMENT_FORMAT_DEFINITIONS).toHaveLength(2);
    expect(TOURNAMENT_FORMAT_DEFINITIONS.map((format) => format.id)).toEqual([
      "king-queen",
      "group-double-elimination",
    ]);
  });

  it("keeps the approved King & Queen entry route", () => {
    expect(KING_QUEEN_FORMAT.route).toBe("/king-queen");
    expect(KING_QUEEN_FORMAT.status).toBe("live");
  });

  it("keeps the new format inside its approved route namespace", () => {
    expect(GROUP_DOUBLE_ELIMINATION_FORMAT.route).toBe(
      "/formats/group-stage-double-elimination"
    );
    expect(GROUP_DOUBLE_ELIMINATION_FORMAT.route.startsWith("/formats/")).toBe(
      true
    );
    expect(GROUP_DOUBLE_ELIMINATION_FORMAT.status).toBe("live");
  });

  it("recognises only supported format ids", () => {
    for (const id of TOURNAMENT_FORMAT_IDS) {
      expect(isTournamentFormat(id)).toBe(true);
      expect(getTournamentFormatDefinition(id).id).toBe(id);
    }

    expect(isTournamentFormat("whist-8")).toBe(false);
    expect(isTournamentFormat("")).toBe(false);
  });
});

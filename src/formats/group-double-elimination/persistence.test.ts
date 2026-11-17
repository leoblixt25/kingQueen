import { describe, expect, it } from "vitest";
import {
  DEFAULT_GSDE_SETTINGS,
  GSDE_COLLECTION,
  GSDE_FORMAT_ID,
  KQ_COLLECTIONS,
  createGsdeTournamentDocument,
  fromGsdeFirestoreData,
  gsdeTournamentPath,
  toGsdeFirestoreData,
} from "./persistence";

describe("new-format Firestore isolation", () => {
  it("writes only under tournaments/{id}", () => {
    expect(GSDE_COLLECTION).toBe("tournaments");
    expect(gsdeTournamentPath("event-1")).toBe("tournaments/event-1");
  });

  it("never overlaps a King & Queen collection", () => {
    expect(KQ_COLLECTIONS).toEqual([
      "players",
      "matches",
      "finalMatches",
      "tournamentSettings",
    ]);
    expect(KQ_COLLECTIONS).not.toContain(GSDE_COLLECTION);
  });

  it("rejects invalid or path-traversing ids", () => {
    expect(() => gsdeTournamentPath("")).toThrow();
    expect(() => gsdeTournamentPath("a/b")).toThrow();
    expect(() => gsdeTournamentPath("..")).toThrow();
    expect(() => gsdeTournamentPath("ok-id")).not.toThrow();
  });

  it("stamps a discriminator that reads can verify", () => {
    const tournament = createGsdeTournamentDocument("event-1");
    const data = toGsdeFirestoreData(tournament);

    expect(data.formatId).toBe(GSDE_FORMAT_ID);
    expect(data.tournament.status).toBe("draft");
  });

  it("round-trips a tournament document", () => {
    const tournament = createGsdeTournamentDocument("event-1", {
      teams: [
        {
          id: "t1",
          name: "Team 1",
          playerIds: ["p1"],
          seed: 1,
          groupId: "group-1",
        },
      ],
    });
    const data = toGsdeFirestoreData(tournament);
    const restored = fromGsdeFirestoreData(data, tournament.id);

    expect(restored).toEqual(tournament);
    expect(restored?.settings).toEqual(DEFAULT_GSDE_SETTINGS);
  });

  it("round-trips immutable player score submissions", () => {
    const submission = {
      matchId: "group-1",
      stage: "group" as const,
      playerUid: "uid-1",
      playerLabel: "player1@test.test",
      submittedAt: "2026-11-17T00:00:00.000Z",
      scoreA: 7,
      scoreB: 3,
      winnerId: "t1",
    };
    const tournament = createGsdeTournamentDocument("event-1", {
      scoreSubmissions: { "uid-1": { "group-1": submission } },
    });
    const data = toGsdeFirestoreData(tournament);
    const restored = fromGsdeFirestoreData(data, tournament.id);

    expect(restored?.scoreSubmissions).toEqual({
      "uid-1": { "group-1": submission },
    });
  });

  it("ignores documents from a foreign format", () => {
    expect(fromGsdeFirestoreData({ formatId: "king-queen" }, "x")).toBeNull();
    expect(fromGsdeFirestoreData(undefined, "x")).toBeNull();
  });

  it("fills defaults for partial legacy-safe documents", () => {
    const restored = fromGsdeFirestoreData(
      { formatId: GSDE_FORMAT_ID, tournament: { status: "group-stage" } },
      "event-2"
    );

    expect(restored?.id).toBe("event-2");
    expect(restored?.teams).toEqual([]);
    expect(restored?.groups).toEqual([]);
    expect(restored?.matches).toEqual([]);
    expect(restored?.elimination).toBeNull();
    expect(restored?.tournament.status).toBe("group-stage");
  });
});

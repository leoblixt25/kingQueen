import { describe, expect, it } from "vitest";
import type { Group, GroupStageMatch } from "./types";
import { generateGroupStageSchedule, applyGroupMatchScore } from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  calculateGroupStandings,
  seedTeamsFromGroupStandings,
  type GroupStanding,
} from "./groupStandings";

const makeGroup = (teamIds: string[], id = "group-1"): Group => ({
  id,
  name: id === "group-1" ? "Group A" : "Group B",
  teamIds,
});

const setup = (teamIds: string[], id = "group-1") => {
  const group = makeGroup(teamIds, id);
  const { matches } = generateGroupStageSchedule([group]);
  return { group, matches };
};

const complete = (
  matches: GroupStageMatch[],
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number
): GroupStageMatch[] => {
  let found = false;
  const next = matches.map((match) => {
    if (match.teamAId === teamAId && match.teamBId === teamBId) {
      found = true;
      return applyGroupMatchScore(match, scoreA, scoreB);
    }
    if (match.teamAId === teamBId && match.teamBId === teamAId) {
      found = true;
      return applyGroupMatchScore(match, scoreB, scoreA);
    }
    return match;
  });

  if (!found) {
    throw new Error(`No match between ${teamAId} and ${teamBId}`);
  }

  return next;
};

const rowFor = (
  rows: readonly GroupStanding[],
  teamId: string
): GroupStanding => {
  const row = rows.find((candidate) => candidate.teamId === teamId);
  if (!row) throw new Error(`No standing for ${teamId}`);
  return row;
};

const rankOf = (rows: readonly GroupStanding[], teamId: string): number =>
  rowFor(rows, teamId).rank;

describe("group standings", () => {
  it("counts only completed matches", () => {
    const { group, matches } = setup(["a", "b", "c"]);
    const played = complete(matches, "a", "b", 21, 15);

    const table = calculateGroupStandings(group, played);

    expect(rowFor(table.rows, "a")).toMatchObject({
      played: 1,
      wins: 1,
      losses: 0,
      pointsFor: 21,
      pointsAgainst: 15,
      pointDifference: 6,
      qualified: true,
    });
    expect(rowFor(table.rows, "b")).toMatchObject({
      played: 1,
      wins: 0,
      losses: 1,
      pointDifference: -6,
    });
    expect(rowFor(table.rows, "c")).toMatchObject({
      played: 0,
      wins: 0,
      losses: 0,
      pointDifference: 0,
    });
  });

  it("ranks by wins", () => {
    const { group, matches } = setup(["a", "b", "c", "d"]);
    let played = matches;
    played = complete(played, "a", "b", 21, 10);
    played = complete(played, "a", "c", 21, 10);
    played = complete(played, "a", "d", 21, 10);
    played = complete(played, "b", "c", 21, 10);
    played = complete(played, "b", "d", 21, 10);
    played = complete(played, "c", "d", 21, 10);

    const table = calculateGroupStandings(group, played);

    expect(table.rows.map((row) => row.teamId)).toEqual(["a", "b", "c", "d"]);
    expect(table.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
  });

  it("breaks a wins tie by head-to-head before point difference", () => {
    const { group, matches } = setup(["a", "b", "c", "d"]);
    let played = matches;
    played = complete(played, "a", "c", 21, 20);
    played = complete(played, "a", "b", 21, 19);
    played = complete(played, "b", "c", 21, 2);
    played = complete(played, "b", "d", 21, 2);
    played = complete(played, "d", "a", 21, 17);

    const table = calculateGroupStandings(group, played);
    const a = rowFor(table.rows, "a");
    const b = rowFor(table.rows, "b");

    expect(a.wins).toBe(b.wins);
    expect(b.pointDifference).toBeGreaterThan(a.pointDifference);
    expect(a.rank).toBeLessThan(b.rank);
  });

  it("resolves a circular three-way tie deterministically", () => {
    const { group, matches } = setup(["a", "b", "c"]);
    let played = matches;
    played = complete(played, "a", "b", 21, 11);
    played = complete(played, "b", "c", 21, 12);
    played = complete(played, "c", "a", 21, 13);

    const table = calculateGroupStandings(group, played);

    expect(table.rows.map((row) => row.teamId)).toEqual(["a", "c", "b"]);
    expect(table.rows.map((row) => row.wins)).toEqual([1, 1, 1]);
  });

  it("falls back to points scored when head-to-head and difference are equal", () => {
    const { group, matches } = setup(["a", "b", "c"]);
    let played = matches;
    played = complete(played, "a", "c", 22, 16);
    played = complete(played, "b", "c", 21, 15);

    const table = calculateGroupStandings(group, played);
    const a = rowFor(table.rows, "a");
    const b = rowFor(table.rows, "b");

    expect(a.wins).toBe(b.wins);
    expect(a.pointDifference).toBe(b.pointDifference);
    expect(a.pointsFor).toBeGreaterThan(b.pointsFor);
    expect(a.rank).toBeLessThan(b.rank);
  });

  it("falls back to team id when everything else is equal", () => {
    const { group, matches } = setup(["b", "a", "c"]);
    let played = matches;
    played = complete(played, "a", "c", 21, 15);
    played = complete(played, "b", "c", 21, 15);

    const table = calculateGroupStandings(group, played);

    expect(rankOf(table.rows, "a")).toBeLessThan(rankOf(table.rows, "b"));
  });

  it("assigns unique sequential ranks and keeps everyone qualified", () => {
    const { group, matches } = setup(["a", "b", "c", "d", "e"]);
    const played = matches.map((match) =>
      applyGroupMatchScore(match, 21, 10)
    );

    const table = calculateGroupStandings(group, played);

    expect(table.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(table.rows.map((row) => row.rank)).size).toBe(5);
    expect(table.rows.every((row) => row.qualified)).toBe(true);
  });

  it("ignores matches from other groups", () => {
    const groupA = makeGroup(["a", "b"], "group-1");
    const groupB = makeGroup(["c", "d"], "group-2");
    const scheduleA = generateGroupStageSchedule([groupA]).matches;
    const scheduleB = generateGroupStageSchedule([groupB]).matches;
    const playedB = applyGroupMatchScore(scheduleB[0], 21, 10);
    const mixed = [...scheduleA, playedB];

    const table = calculateGroupStandings(groupA, mixed);

    expect(table.rows.map((row) => row.played)).toEqual([0, 0]);
  });
});

describe("elimination seeding from group standings", () => {
  it("seeds all group winners first, then runners-up", () => {
    const groupA = makeGroup(["a1", "a2"], "group-1");
    const groupB = makeGroup(["b1", "b2"], "group-2");
    const scheduleA = generateGroupStageSchedule([groupA]).matches;
    const scheduleB = generateGroupStageSchedule([groupB]).matches;
    const matches = [
      ...complete(scheduleA, "a1", "a2", 21, 10),
      ...complete(scheduleB, "b1", "b2", 21, 10),
    ];

    const tables = calculateAllGroupStandings([groupA, groupB], matches);
    const seeded = seedTeamsFromGroupStandings(tables);

    expect(seeded).toEqual(["a1", "b1", "a2", "b2"]);
    expect(new Set(seeded).size).toBe(4);
  });

  it("is independent of table order", () => {
    const groupA = makeGroup(["a1", "a2"], "group-1");
    const groupB = makeGroup(["b1", "b2"], "group-2");
    const matches = [
      ...complete(generateGroupStageSchedule([groupA]).matches, "a1", "a2", 21, 10),
      ...complete(generateGroupStageSchedule([groupB]).matches, "b1", "b2", 21, 10),
    ];
    const tables = calculateAllGroupStandings([groupA, groupB], matches);

    expect(seedTeamsFromGroupStandings([...tables].reverse())).toEqual(
      seedTeamsFromGroupStandings(tables)
    );
  });
});

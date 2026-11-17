import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  where,
  query,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type {
  EliminationBracket,
  Group,
  GroupStageMatch,
  GsdeTournamentStatus,
  Team,
  TournamentConfig,
} from "./types";

/**
 * Isolated persistence for the new format.
 *
 * Every write in this module targets `tournaments/{id}` and nothing else. The
 * King & Queen collections (`players`, `matches`, `finalMatches`,
 * `tournamentSettings`) are never referenced here. A `formatId` discriminator
 * on each document means a foreign document in the shared `tournaments`
 * collection is ignored on read.
 *
 * The whole tournament is stored as a single document because a 16-team event
 * is small and a single write keeps standings, matches and bracket atomic.
 */

/** The only collection this module may ever touch. */
export const GSDE_COLLECTION = "tournaments";
export const GSDE_FORMAT_ID = "group-double-elimination" as const;

/** Collections owned by King & Queen. Kept here so the isolation is testable. */
export const KQ_COLLECTIONS = [
  "players",
  "matches",
  "finalMatches",
  "tournamentSettings",
] as const;

export interface GsdeSettings {
  formatId: typeof GSDE_FORMAT_ID;
  /** Approved esports game-number registry. */
  gameNumbering: "esports-16";
  /** Final placements are shared when teams are tied. */
  placementTiePolicy: "shared";
  /** Deterministic immediate-rematch prevention is enabled. */
  avoidRematches: boolean;
  /** Reset final when an undefeated finalist loses the first Grand Final. */
  grandFinalReset: boolean;
  /** Fixed tiebreaker order for group ranking. */
  groupTiebreakers: readonly string[];
}

export const DEFAULT_GSDE_SETTINGS: GsdeSettings = {
  formatId: GSDE_FORMAT_ID,
  gameNumbering: "esports-16",
  placementTiePolicy: "shared",
  avoidRematches: true,
  grandFinalReset: true,
  groupTiebreakers: [
    "wins",
    "head-to-head",
    "point-difference",
    "points-scored",
    "team-id",
  ],
};

export interface GsdeTournamentDocument {
  id: string;
  tournament: {
    config: TournamentConfig;
    status: GsdeTournamentStatus;
    /** Set when a group score was corrected after a bracket existed. */
    seedingStale: boolean;
    /** Set when an admin generated the bracket before the group stage finished. */
    bracketOverrideUsed?: boolean;
    /** Set by the explicit group-stage completion step. */
    groupStageVerified?: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  teams: Team[];
  groups: Group[];
  /** Group-stage matches (the `matches` entity in the data model). */
  matches: GroupStageMatch[];
  /** Elimination bracket, `null` until all group matches are complete. */
  elimination: EliminationBracket | null;
  settings: GsdeSettings;
}

export const createGsdeTournamentDocument = (
  id: string,
  overrides: Partial<GsdeTournamentDocument> = {}
): GsdeTournamentDocument => ({
  id,
  tournament: {
    config: {
      name: "",
      date: "",
      teamLimit: 16,
      divisionName: "Open",
      groupCount: 4,
      matchFormat: "single-set",
      teamsPerGroup: 4,
      advanceAllTeams: true,
      grandFinalReset: true,
    },
    status: "draft",
    seedingStale: false,
    bracketOverrideUsed: false,
    groupStageVerified: false,
    createdAt: null,
    updatedAt: null,
    ...(overrides.tournament ?? {}),
  },
  teams: overrides.teams ?? [],
  groups: overrides.groups ?? [],
  matches: overrides.matches ?? [],
  elimination: overrides.elimination ?? null,
  settings: { ...DEFAULT_GSDE_SETTINGS, ...(overrides.settings ?? {}) },
});

const assertValidTournamentId = (id: string): void => {
  if (
    typeof id !== "string" ||
    id.trim() === "" ||
    id.includes("/") ||
    id === "." ||
    id === ".."
  ) {
    throw new Error(`Invalid tournament id "${id}".`);
  }
};

/** Canonical document path. Pure and used by the isolation tests. */
export const gsdeTournamentPath = (id: string): string => {
  assertValidTournamentId(id);
  return `${GSDE_COLLECTION}/${id}`;
};

/** Builds the only Firestore reference used by this module. */
export const gsdeTournamentRef = (id: string): DocumentReference<DocumentData> =>
  doc(db, GSDE_COLLECTION, id);

/**
 * Pure serializer. The discriminator is written first so reads can reject a
 * foreign document before interpreting any of its fields.
 */
export const toGsdeFirestoreData = (
  tournament: GsdeTournamentDocument
): DocumentData => ({
  formatId: GSDE_FORMAT_ID,
  tournament: tournament.tournament,
  teams: tournament.teams,
  groups: tournament.groups,
  matches: tournament.matches,
  elimination: tournament.elimination,
  settings: tournament.settings,
});

/** Pure deserializer that refuses foreign-format and malformed documents. */
export const fromGsdeFirestoreData = (
  data: DocumentData | undefined,
  id: string
): GsdeTournamentDocument | null => {
  if (!data || data.formatId !== GSDE_FORMAT_ID) return null;

  const base = createGsdeTournamentDocument(id);
  return {
    id,
    tournament: { ...base.tournament, ...(data.tournament ?? {}) },
    teams: Array.isArray(data.teams) ? data.teams : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    matches: Array.isArray(data.matches) ? data.matches : [],
    elimination: data.elimination ?? null,
    settings: { ...base.settings, ...(data.settings ?? {}) },
  };
};

export const saveGsdeTournament = async (
  tournament: GsdeTournamentDocument
): Promise<void> => {
  gsdeTournamentPath(tournament.id);
  await setDoc(gsdeTournamentRef(tournament.id), toGsdeFirestoreData(tournament));
};

export const loadGsdeTournament = async (
  id: string
): Promise<GsdeTournamentDocument | null> => {
  gsdeTournamentPath(id);
  const snapshot = await getDoc(gsdeTournamentRef(id));
  return fromGsdeFirestoreData(snapshot.data(), id);
};

export const subscribeGsdeTournament = (
  id: string,
  onData: (tournament: GsdeTournamentDocument | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  gsdeTournamentPath(id);
  return onSnapshot(
    gsdeTournamentRef(id),
    (snapshot) => onData(fromGsdeFirestoreData(snapshot.data(), id)),
    onError
  );
};

export const deleteGsdeTournament = async (id: string): Promise<void> => {
  gsdeTournamentPath(id);
  await deleteDoc(gsdeTournamentRef(id));
};

export const listGsdeTournaments = async (): Promise<
  GsdeTournamentDocument[]
> => {
  const tournaments = collection(db, GSDE_COLLECTION);
  const onlyThisFormat = query(
    tournaments,
    where("formatId", "==", GSDE_FORMAT_ID)
  );
  const snapshot = await getDocs(onlyThisFormat);

  return snapshot.docs
    .map((document) =>
      fromGsdeFirestoreData(document.data(), document.id)
    )
    .filter((item): item is GsdeTournamentDocument => item !== null);
};

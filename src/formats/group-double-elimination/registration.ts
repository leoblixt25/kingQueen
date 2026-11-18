import type { PlayerGender, PlayerRegistration } from "./types";
import type { GsdeTournamentDocument } from "./persistence";

/**
 * Pure helpers for self-service player registration.
 *
 * Registration is individual (like King & Queen) but is stored ONLY in the
 * isolated `tournaments/{id}` document. The Firebase Auth uid is the identity;
 * an admin approves the player and assigns them to a team, which fills that
 * team's `playerIds`. This module has no React or Firebase dependency.
 */

export interface RegistrationDraft {
  uid: string;
  email: string;
  name: string;
  gender: PlayerGender;
}

export interface RegistrationIssue {
  field: "uid" | "email" | "name" | "gender";
  message: string;
}

export const PLAYER_GENDER_OPTIONS: ReadonlyArray<{
  value: PlayerGender;
  label: string;
}> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Emails are stored and compared lower-cased, matching the K&Q convention. */
export const normalizeRegistrationEmail = (email: string): string =>
  email.trim().toLowerCase();

export const getRegistrations = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] => doc.registrations ?? [];

/** Validate the player-supplied fields before any mutation is attempted. */
export const validateRegistrationDraft = (
  draft: RegistrationDraft
): RegistrationIssue[] => {
  const issues: RegistrationIssue[] = [];
  if (!draft.uid || !draft.uid.trim()) {
    issues.push({ field: "uid", message: "A signed-in account is required." });
  }
  if (!normalizeRegistrationEmail(draft.email)) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRegistrationEmail(draft.email))) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  }
  const name = draft.name.trim();
  if (name.length < 2) {
    issues.push({ field: "name", message: "Enter your name (at least 2 characters)." });
  }
  if (draft.gender !== "male" && draft.gender !== "female") {
    issues.push({ field: "gender", message: "Select your player gender." });
  }
  return issues;
};

export const findRegistrationByUid = (
  doc: GsdeTournamentDocument,
  uid: string
): PlayerRegistration | undefined =>
  uid ? getRegistrations(doc).find((item) => item.uid === uid) : undefined;

export const findRegistrationByEmail = (
  doc: GsdeTournamentDocument,
  email: string
): PlayerRegistration | undefined => {
  const normalized = normalizeRegistrationEmail(email);
  return normalized
    ? getRegistrations(doc).find((item) => normalizeRegistrationEmail(item.email) === normalized)
    : undefined;
};

/**
 * The team a signed-in player is allowed to see. Only an APPROVED registration
 * with an assigned team resolves to a team id — pending/rejected players never
 * get an automatic team link.
 */
export const getRegisteredTeamId = (
  doc: GsdeTournamentDocument,
  uid: string
): string | null => {
  const registration = findRegistrationByUid(doc, uid);
  return registration?.status === "approved" ? registration.teamId : null;
};

export interface RegistrationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
}

export const getRegistrationStats = (
  doc: GsdeTournamentDocument
): RegistrationStats => {
  const registrations = getRegistrations(doc);
  return {
    total: registrations.length,
    pending: registrations.filter((item) => item.status === "pending").length,
    approved: registrations.filter((item) => item.status === "approved").length,
    rejected: registrations.filter((item) => item.status === "rejected").length,
    assigned: registrations.filter(
      (item) => item.status === "approved" && Boolean(item.teamId)
    ).length,
  };
};

/** Registrations awaiting an admin decision, oldest first. */
export const selectPendingRegistrations = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] =>
  getRegistrations(doc)
    .filter((item) => item.status === "pending")
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));

import type { GsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";

/**
 * Offline JSON backup of a GSDE tournament. Used automatically before any
 * destructive admin reset and available on demand from the export card.
 */
export const gsdeJsonFileName = (doc: GsdeTournamentDocument): string => {
  const safeId = doc.id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "tournament";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `GSDE-${safeId}-backup-${stamp}.json`;
};

export const buildGsdeTournamentJson = (doc: GsdeTournamentDocument): string =>
  JSON.stringify(
    {
      formatId: "group-double-elimination",
      exportedAt: new Date().toISOString(),
      tournament: doc,
    },
    null,
    2
  );

export const downloadGsdeTournamentJson = (doc: GsdeTournamentDocument): string => {
  const fileName = gsdeJsonFileName(doc);
  const blob = new Blob([buildGsdeTournamentJson(doc)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return fileName;
};

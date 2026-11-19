/**
 * Group Stage + Double Elimination — public module surface.
 *
 * Everything here is pure TypeScript and independent of React and Firebase.
 * King & Queen modules must never import from this tree, and this tree must
 * never import King & Queen tournament logic.
 */
export * from "./types";
export * from "./config";
export * from "./category";
export * from "./notImplemented";
export * from "./compare";
export * from "./errors";
export * from "./teams";
export * from "./groups";
export * from "./groupStageMatches";
export * from "./groupStandings";
export * from "./groupStage";
export * from "./elimination";
export * from "./bracket";
export * from "./winnersBracket";
export * from "./losersBracket";
export * from "./progression";
export * from "./eliminationStandings";
export * from "./admin";
export * from "./gameNumbers";
export * from "./spanishCrossover";
export * from "./rematchPrevention";
export * from "./fixed16";
export * from "./sizeAware";
export * from "./report";

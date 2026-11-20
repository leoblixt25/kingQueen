import GroupDoubleEliminationPlayerAccess from "./PlayerAccess";

/**
 * `/pairing` is now an alias of the pairing dashboard at `/player-access`.
 * Keeping the route avoids breaking existing links while guaranteeing a single
 * implementation of invitations, state redirects and mobile presentation.
 */
export default function GroupDoubleEliminationPairing() {
  return <GroupDoubleEliminationPlayerAccess />;
}

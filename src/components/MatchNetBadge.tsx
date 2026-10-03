/**
 * Net (court) label for a matchup card.
 *
 * Display-only. When `onToggle` is supplied the label becomes a control that
 * moves the match to the other net, which is how an admin overrides the
 * automatic assignment.
 */
import { Loader2 } from 'lucide-react';
import { netLabel, type NetNumber } from '@/utils/netAssignment';

type Props = {
  net: NetNumber;
  /** Omit for a plain read-only label. */
  onToggle?: () => void;
  busy?: boolean;
  className?: string;
};

export default function MatchNetBadge({ net, onToggle, busy = false, className = '' }: Props) {
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide';

  if (!onToggle) {
    return (
      <span
        className={`${base} bg-ocean/15 text-ocean-dark border border-ocean/30 ${className}`}
        title={`${netLabel(net)} - where this match is played`}
      >
        {netLabel(net)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={`Assigned to ${netLabel(net)}. Click to move to ${netLabel(net === 1 ? 2 : 1)}.`}
      className={`${base} bg-ocean text-white border border-ocean-dark/40 hover:bg-ocean-dark transition-colors duration-200 disabled:opacity-60 cursor-pointer ${className}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
      {netLabel(net)}
    </button>
  );
}
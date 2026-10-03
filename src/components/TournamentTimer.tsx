/**
 * Tournament timer (HH:MM).
 *
 * Reads the start/end timestamps from Firestore, so it survives refreshes and
 * shows the same value on every device. Counts up live while the tournament is
 * running and freezes at the final duration once the final result is submitted.
 *
 * Renders nothing until the tournament has been started, so it never appears on
 * tournaments that do not use the feature.
 */
import { useEffect, useState } from 'react';
import { Timer as TimerIcon } from 'lucide-react';
import { useTournamentControl } from '@/hooks/useTournamentControl';
import { formatElapsed, isTimerRunning } from '@/utils/tournamentControl';

type Props = {
  className?: string;
  /** Show the "Live"/"Finished" state label next to the clock. */
  showStatus?: boolean;
};

export default function TournamentTimer({ className = '', showStatus = false }: Props) {
  const control = useTournamentControl();
  const [now, setNow] = useState(() => Date.now());

  const running = isTimerRunning(control);

  useEffect(() => {
    // Only tick while the clock is actually running; a frozen timer needs no updates.
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (control.loading || control.tournamentStartTime === null) return null;

  const finished = control.tournamentEndTime !== null;

  return (
    <div
      className={
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold tabular-nums ' +
        (finished
          ? 'border-sunset/30 bg-sunset/10 text-sunset-dark'
          : 'border-ocean/30 bg-ocean/10 text-ocean-dark') +
        ' ' +
        className
      }
      title={finished ? 'Final tournament duration' : 'Tournament running'}
    >
      <TimerIcon className="h-4 w-4" aria-hidden="true" />
      <span>{formatElapsed(control, now)}</span>
      {showStatus && (
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {finished ? 'Final' : 'Live'}
        </span>
      )}
    </div>
  );
}
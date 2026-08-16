import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Timer, ChevronLeft } from 'lucide-react';

export default function WaitingForDraw({ onDrawComplete }: { onDrawComplete: () => void }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [drawTarget, setDrawTarget] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournamentSettings', 'settings'), snap => {
      if (snap.exists() && snap.data()?.draw_completed === true) onDrawComplete();
    });
    return () => unsub();
  }, [onDrawComplete]);

  // Load the draw date (day before the tournament) for the countdown
  useEffect(() => {
    async function loadDrawTarget() {
      try {
        const defaultSnap = await getDoc(doc(db, 'tournamentSettings', 'default_settings'));
        const dateStr = defaultSnap.exists() ? defaultSnap.data().tournament_date : null;
        if (dateStr) {
          // Count to the end of the draw day (day before the tournament)
          const target = new Date(`${dateStr}T00:00:00`);
          setDrawTarget(target.getTime());
        }
      } catch (e) { console.error(e); }
    }
    loadDrawTarget();
  }, []);

  // Countdown tick — updates every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = drawTarget ? Math.max(0, drawTarget - now.getTime()) : null;
  const days = remaining ? Math.floor(remaining / 86400000) : 0;
  const hours = remaining ? Math.floor((remaining % 86400000) / 3600000) : 0;
  const mins = remaining ? Math.floor((remaining % 3600000) / 60000) : 0;
  const secs = remaining ? Math.floor((remaining % 60000) / 1000) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-sand-gradient px-4 pt-24 pb-8 flex items-start justify-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        <div className="text-6xl">🎟️</div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
          Tournament Draw
        </h1>
        <Card className="bg-white/80 backdrop-blur-sm border border-ocean/20 shadow-beach">
          <CardContent className="p-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber/20 text-amber-700 text-xs font-semibold">
              <Timer size={14} />
              Not started yet
            </div>
            <p className="text-foreground/70 leading-relaxed">
              The tournament draw has not started yet. The live draw and matchups will be available in
              Tournament draw page the day before the tournament. Once it's completed, you will have access
              to your matchups division to be able to submit your matches scores and to see your ranking in real time.
            </p>

            {/* Countdown to the draw */}
            {drawTarget && remaining !== null && (
              <div className="pt-2">
                {remaining > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">
                      Draw starts in
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex-1 max-w-[72px] bg-ocean/10 rounded-xl py-3 px-1 border border-ocean/20">
                        <div className="text-2xl font-bold text-ocean-dark tabular-nums">{pad(days)}</div>
                        <div className="text-[10px] font-semibold text-foreground/50 uppercase">days</div>
                      </div>
                      <span className="text-xl font-bold text-foreground/30">:</span>
                      <div className="flex-1 max-w-[72px] bg-ocean/10 rounded-xl py-3 px-1 border border-ocean/20">
                        <div className="text-2xl font-bold text-ocean-dark tabular-nums">{pad(hours)}</div>
                        <div className="text-[10px] font-semibold text-foreground/50 uppercase">hours</div>
                      </div>
                      <span className="text-xl font-bold text-foreground/30">:</span>
                      <div className="flex-1 max-w-[72px] bg-ocean/10 rounded-xl py-3 px-1 border border-ocean/20">
                        <div className="text-2xl font-bold text-ocean-dark tabular-nums">{pad(mins)}</div>
                        <div className="text-[10px] font-semibold text-foreground/50 uppercase">min</div>
                      </div>
                      <span className="text-xl font-bold text-foreground/30">:</span>
                      <div className="flex-1 max-w-[72px] bg-ocean/10 rounded-xl py-3 px-1 border border-ocean/20">
                        <div className="text-2xl font-bold text-ocean-dark tabular-nums">{pad(secs)}</div>
                        <div className="text-[10px] font-semibold text-foreground/50 uppercase">sec</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sunset/20 text-sunset-dark text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    The draw is starting now — refresh to watch live!
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-foreground/50">
              Please check back later!
            </p>
          </CardContent>
        </Card>
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full touch-target"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
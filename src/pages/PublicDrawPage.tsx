import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { FC, MC, paintCanvas } from '@/utils/drawWheel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ChevronLeft, CheckCircle2, Timer } from 'lucide-react';

interface Player { id: string; name: string; gender: string; status: string; }
interface DrawnMatch { matchNum: number; p1: string; p2: string; p3: string; p4: string; }

export default function PublicDrawPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drawStarted, setDrawStarted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fMatches, setFMatches] = useState<DrawnMatch[]>([]);
  const [mMatches, setMMatches] = useState<DrawnMatch[]>([]);
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers] = useState<Player[]>([]);
  const [drawTarget, setDrawTarget] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'female' | 'male'>('female');

  // LIVE MIRROR state (fed by the admin draw page pick-by-pick)
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveActive, setLiveActive] = useState<'f' | 'm' | null>(null);
  const [liveOrderF, setLiveOrderF] = useState<string[]>([]);
  const [liveOrderM, setLiveOrderM] = useState<string[]>([]);
  const [livePicksF, setLivePicksF] = useState<string[]>([]);
  const [livePicksM, setLivePicksM] = useState<string[]>([]);

  const fCanvasRef = useRef<HTMLCanvasElement>(null);
  const mCanvasRef = useRef<HTMLCanvasElement>(null);
  const fOrder = useRef<string[]>([]);
  const mOrder = useRef<string[]>([]);

  function applySettings(data: any, completed: boolean) {
    setDrawStarted(completed || ((data.drawn_female_matches?.length || 0) > 0) || ((data.drawn_male_matches?.length || 0) > 0));
    setSaved(completed);
    if (data.drawn_female_matches) setFMatches(data.drawn_female_matches);
    if (data.drawn_male_matches) setMMatches(data.drawn_male_matches);
    if (completed) {
      const fNames: string[] = [...new Set((data.drawn_female_matches || []).flatMap((m: DrawnMatch) => [m.p1, m.p2, m.p3, m.p4]))];
      const mNames: string[] = [...new Set((data.drawn_male_matches || []).flatMap((m: DrawnMatch) => [m.p1, m.p2, m.p3, m.p4]))];
      fOrder.current = fNames;
      mOrder.current = mNames;
    }

    // LIVE MIRROR: parse broadcast fields defensively — anything missing or
    // malformed simply leaves the page on its normal countdown/results view.
    setLiveRunning(data.live_draw_status === 'running');
    const act = data.live_draw_active;
    setLiveActive(act === 'f' || act === 'm' ? act : null);
    if (Array.isArray(data.live_draw_order_f)) setLiveOrderF(data.live_draw_order_f);
    if (Array.isArray(data.live_draw_order_m)) setLiveOrderM(data.live_draw_order_m);
    if (Array.isArray(data.live_draw_picks_f)) setLivePicksF(data.live_draw_picks_f);
    if (Array.isArray(data.live_draw_picks_m)) setLivePicksM(data.live_draw_picks_m);
  }

  useEffect(() => {
    async function load() {
      // Load settings and default_settings in parallel so the page shows the
      // countdown without waiting for the (larger) players collection. Players
      // are only needed for the spin wheels, which appear after the draw is done,
      // so they are fetched in the background below.
      const [settingsSnap, defaultSnap] = await Promise.allSettled([
        getDoc(doc(db, 'tournamentSettings', 'settings')),
        getDoc(doc(db, 'tournamentSettings', 'default_settings')),
      ]);

      if (settingsSnap.status === 'fulfilled' && settingsSnap.value.exists()) {
        applySettings(settingsSnap.value.data(), !!settingsSnap.value.data().draw_completed);
      }

      if (defaultSnap.status === 'fulfilled' && defaultSnap.value.exists()) {
        const dateStr = defaultSnap.value.data().tournament_date;
        if (dateStr) {
          // Draw is at 9pm the day before the tournament
          const target = new Date(`${dateStr}T21:00:00`);
          target.setDate(target.getDate() - 1);
          setDrawTarget(target.getTime());
        }
      }
      setLoading(false);
    }
    load();

    // Load approved players in the background so the spin wheels show names
    // exactly like the admin draw page. Not blocking: wheels fall back to the
    // drawn match names and repaint once players arrive.
    getDocs(collection(db, 'players'))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
        all.forEach(p => { if (p.name) p.name = p.name.trim(); });
        setFemalePlayers(all.filter(p => p.gender === 'female' && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));
        setMalePlayers(all.filter(p => p.gender === 'male' && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));
      })
      .catch(err => console.error('Failed to load players on public draw page:', err));

    // Live: update the moment the admin starts/saves the draw
    const unsub = onSnapshot(doc(db, 'tournamentSettings', 'settings'), (snap) => {
      if (snap.exists()) applySettings(snap.data(), !!snap.data().draw_completed);
      else { setDrawStarted(false); setSaved(false); }
    });

    return () => unsub();
  }, []);

  // Countdown tick — updates every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function paint() {
      (['f', 'm'] as const).forEach(d => {
        const cv = d === 'f' ? fCanvasRef.current : mCanvasRef.current;
        if (!cv) return;
        const sz = cv.parentElement?.offsetWidth || 200;
        cv.width = sz; cv.height = sz;
        const order = d === 'f' ? fOrder.current : mOrder.current;
        const names = order.length ? order : (d === 'f' ? femalePlayers : malePlayers).map(p => p.name);
        paintCanvas(cv, 0, names, d === 'f' ? FC : MC);
      });
    }
    paint();
    const t = setTimeout(paint, 60);
    window.addEventListener('resize', paint);
    return () => { window.removeEventListener('resize', paint); clearTimeout(t); };
  }, [loading, saved, femalePlayers, malePlayers, fOrder.current.length, mOrder.current.length, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-gradient flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">🏐</div>
          <p className="text-foreground/60">Loading draw…</p>
        </div>
      </div>
    );
  }

  // LIVE MIRROR: while the admin is running the draw, show picks appearing in
  // real time. If anything is missing, fall through to the normal views.
  if (!saved && liveRunning && liveActive) {
    const hasNames = liveActive === 'f'
      ? (liveOrderF.length > 0 || femalePlayers.length > 0)
      : (liveOrderM.length > 0 || malePlayers.length > 0);
    if (hasNames) {
      return (
        <LiveDrawView
          liveActive={liveActive}
          orderF={liveOrderF}
          orderM={liveOrderM}
          picksF={livePicksF}
          picksM={livePicksM}
          fallbackF={femalePlayers.map(p => p.name)}
          fallbackM={malePlayers.map(p => p.name)}
        />
      );
    }
  }

  if (!drawStarted || !saved) {
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
                The tournament draw has not started yet. The live draw will be available here the day before the tournament.
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

  const PDF_BLUE = 'bg-[#0077B6]';
  const PDF_ORANGE = 'bg-[#FF7F50]';

  function renderMatchGrid(matches: DrawnMatch[], title: string) {
    if (matches.length === 0) return null;
    return (
      <div className="mt-4 w-full">
        <h3 className="text-sm font-semibold text-foreground/70 mb-4 text-center">
          {title}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3">
          {matches.map((m) => (
            <div key={m.matchNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Match {m.matchNum}</span>
              </div>
              <div className="p-2 flex flex-col gap-1">
                <div className={`${PDF_BLUE} text-white rounded-md py-1 px-1.5`}>
                  <div className="text-[14px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
                    {m.p1} & {m.p2}
                  </div>
                </div>
                <div className="text-[10px] font-bold text-gray-400 text-center py-0.5">VS</div>
                <div className={`${PDF_ORANGE} text-white rounded-md py-1 px-1.5`}>
                  <div className="text-[14px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
                    {m.p3} & {m.p4}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderWheel(gender: 'f' | 'm', matches: DrawnMatch[], players: Player[]) {
    const isFemale = gender === 'f';
    const cvRef = isFemale ? fCanvasRef : mCanvasRef;
    return (
      <div className="flex flex-col items-center">
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold mb-4 ${
          isFemale
            ? 'bg-gradient-to-r from-sunset/20 to-[#FF6B6B]/20 text-sunset-dark border border-sunset/30'
            : 'bg-gradient-to-r from-ocean/20 to-[#00B4DB]/20 text-ocean-dark border border-ocean/30'
        }`}>
          {isFemale ? '👩 Female Division' : '👨 Male Division'}
        </div>
        <div className="relative w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] mb-4">
          <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${isFemale ? 'bg-sunset' : 'bg-ocean'}`} />
          <canvas
            ref={cvRef}
            className="relative z-10 w-full h-full rounded-full shadow-2xl"
            style={{ boxShadow: `0 8px 32px ${isFemale ? 'rgba(255,127,80,0.3)' : 'rgba(78,205,196,0.3)'}` }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg z-20 flex items-center justify-center">
            <Target size={20} className={isFemale ? 'text-sunset' : 'text-ocean'} />
          </div>
        </div>
        <p className="text-sm text-foreground/60 text-center font-medium mb-2 min-h-[20px]">
          {matches.length} matches drawn
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 text-xs font-semibold text-foreground/60 mb-3">
            <Target size={14} />
            Live Draw
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
            Tournament Draw
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {saved ? 'Draw completed' : 'Draw in progress'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 max-w-md mx-auto mb-8">
          <Button
            onClick={() => setActiveTab('female')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              activeTab === 'female'
                ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
            }`}
          >
            👩 Female
          </Button>
          <Button
            onClick={() => setActiveTab('male')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              activeTab === 'male'
                ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
            }`}
          >
            👨 Male
          </Button>
        </div>

        <div className="w-full space-y-10">
          <div>
            {activeTab === 'female' && (
              <>
                {renderWheel('f', fMatches, femalePlayers)}
                {renderMatchGrid(fMatches, `${fMatches.length} Female Matches`)}
              </>
            )}
            {activeTab === 'male' && (
              <>
                {renderWheel('m', mMatches, malePlayers)}
                {renderMatchGrid(mMatches, `${mMatches.length} Male Matches`)}
              </>
            )}
          </div>

          <div className="text-center pt-2 pb-4">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full sm:w-auto touch-target"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LiveDrawViewProps {
  liveActive: 'f' | 'm';
  orderF: string[];
  orderM: string[];
  picksF: string[];
  picksM: string[];
  fallbackF: string[];
  fallbackM: string[];
}

/**
 * LIVE MIRROR: read-only view shown while the admin draw is running.
 * Matchups appear one-by-one as the admin's wheel lands each pick —
 * state comes straight from Firestore, so every device stays in sync
 * and late joiners see the current progress immediately.
 */
function LiveDrawView({ liveActive, orderF, orderM, picksF, picksM, fallbackF, fallbackM }: LiveDrawViewProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'female' | 'male'>(liveActive === 'm' ? 'male' : 'female');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const animRef = useRef(0);
  const prevFCount = useRef(0);
  const prevMCount = useRef(0);

  // Follow whichever gender the admin is currently drawing
  useEffect(() => { setTab(liveActive === 'm' ? 'male' : 'female'); }, [liveActive]);

  const isFemale = tab === 'female';
  const order = isFemale ? orderF : orderM;
  const fallback = isFemale ? fallbackF : fallbackM;
  const picks = isFemale ? picksF : picksM;

  // Same easing/spin math as the admin wheel: animate to the segment of `target`
  function spinTo(pool: string[], col: string[], target: string) {
    const cv = canvasRef.current;
    if (!cv || !pool.length) return;
    const ti = pool.indexOf(target);
    if (ti < 0) return;
    animRef.current += 1;
    const myAnim = animRef.current;
    const n = pool.length, arc = (2 * Math.PI) / n;
    const ta = ti * arc + arc / 2;
    const norm = ((-angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let diff = ta - norm; if (diff < 0) diff += 2 * Math.PI;
    const tot = (2 + Math.floor(Math.random() * 2)) * 2 * Math.PI + diff;
    const dur = 900 + Math.random() * 300, t0 = performance.now(), a0 = angleRef.current;
    function frame(now: number) {
      const t = Math.min((now - t0) / dur, 1), ease = 1 - Math.pow(1 - t, 4);
      angleRef.current = a0 + tot * ease;
      paintCanvas(cv, angleRef.current, pool, col);
      if (t < 1 && animRef.current === myAnim) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  useEffect(() => {
    function paint() {
      const cv = canvasRef.current;
      if (!cv) return;
      animRef.current += 1; // cancel any in-flight spin before repainting statically
      const sz = cv.parentElement?.offsetWidth || 300;
      cv.width = sz; cv.height = sz;
      const names = order.length ? order : fallback;
      if (names.length) paintCanvas(cv, angleRef.current, names, isFemale ? FC : MC);
    }
    paint();
    const t = setTimeout(paint, 60);
    window.addEventListener('resize', paint);
    return () => { window.removeEventListener('resize', paint); clearTimeout(t); };
  }, [isFemale, order, fallback]);

  // When a new pick arrives from Firestore, spin the wheel to it like the admin page
  useEffect(() => {
    const prevRef = isFemale ? prevFCount : prevMCount;
    const n = picks.length;
    if (n > prevRef.current) {
      const pool = order.length ? order : fallback;
      const latest = picks[n - 1];
      if (latest && pool.includes(latest)) spinTo(pool, isFemale ? FC : MC, latest);
    }
    prevRef.current = n;
  }, [picks, isFemale, order, fallback]);

  const n = picks.length;
  const completeCount = Math.floor(n / 4);
  const within = n % 4;
  const isActiveGender = (liveActive === 'f') === isFemale;
  let status: string;
  if (!isActiveGender) status = completeCount >= 7 ? 'Complete!' : `${completeCount} matches drawn`;
  else if (n === 0) status = 'Get ready…';
  else if (within === 0) status = `Match ${completeCount} drawn`;
  else status = `Match ${completeCount + 1} in progress — ${picks[n - 1]} picked!`;

  // Only fully drawn matches become cards; a partial match shows via the status line
  const matches: DrawnMatch[] = [];
  for (let i = 0; i < completeCount; i++) {
    matches.push({ matchNum: i + 1, p1: picks[i * 4], p2: picks[i * 4 + 1], p3: picks[i * 4 + 2], p4: picks[i * 4 + 3] });
  }

  const PDF_BLUE = 'bg-[#0077B6]';
  const PDF_ORANGE = 'bg-[#FF7F50]';

  return (
    <div className="min-h-screen bg-sand-gradient">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-xs font-semibold text-red-600 border border-red-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live now
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
            Tournament Draw
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Watch the draw happen in real time</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 max-w-md mx-auto mb-8">
          <Button
            onClick={() => setTab('female')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              tab === 'female'
                ? 'bg-sunset hover:bg-sunset-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-sunset hover:text-white border-sunset/30 text-sunset-dark shadow-sand'
            }`}
          >
            👩 Female
          </Button>
          <Button
            onClick={() => setTab('male')}
            className={`flex-1 touch-target font-semibold text-base py-3 transition-all duration-300 ${
              tab === 'male'
                ? 'bg-ocean hover:bg-ocean-dark text-white shadow-beach'
                : 'bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean-dark shadow-sand'
            }`}
          >
            👨 Male
          </Button>
        </div>

        <div className="w-full space-y-10">
          <div className="flex flex-col items-center">
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold mb-4 ${
              isFemale
                ? 'bg-gradient-to-r from-sunset/20 to-[#FF6B6B]/20 text-sunset-dark border border-sunset/30'
                : 'bg-gradient-to-r from-ocean/20 to-[#00B4DB]/20 text-ocean-dark border border-ocean/30'
            }`}>
              {isFemale ? '👩 Female Division' : '👨 Male Division'}
            </div>

            {/* Wheel */}
            <div className="relative w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] mb-4">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
              </div>
              <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${isFemale ? 'bg-sunset' : 'bg-ocean'}`} />
              <canvas
                ref={canvasRef}
                className="relative z-10 w-full h-full rounded-full shadow-2xl"
                style={{ boxShadow: `0 8px 32px ${isFemale ? 'rgba(255,127,80,0.3)' : 'rgba(78,205,196,0.3)'}` }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg z-20 flex items-center justify-center">
                <Target size={20} className={isFemale ? 'text-sunset' : 'text-ocean'} />
              </div>
            </div>

            {/* Status */}
            <p className="text-sm font-semibold text-foreground/70 text-center mb-6 min-h-[20px]">
              {status}
            </p>

            {/* Matches revealed so far */}
            {matches.length > 0 && (
              <div className="mt-2 w-full">
                <h3 className="text-sm font-semibold text-foreground/70 mb-4 text-center">
                  {matches.length} {isFemale ? 'Female' : 'Male'} Matches
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3">
                  {matches.map((m) => (
                    <div key={m.matchNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                      <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Match {m.matchNum}</span>
                      </div>
                      <div className="p-2 flex flex-col gap-1">
                        <div className={`${PDF_BLUE} text-white rounded-md py-1 px-1.5`}>
                          <div className="text-[14px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
                            {m.p1} & {m.p2}
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 text-center py-0.5">VS</div>
                        <div className={`${PDF_ORANGE} text-white rounded-md py-1 px-1.5`}>
                          <div className="text-[14px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
                            {m.p3} & {m.p4}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-2 pb-4">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full sm:w-auto touch-target"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
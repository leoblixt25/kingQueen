import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { FC, MC, paintCanvas } from '@/utils/drawWheel';
import { generateMatchesFromOrder, shuffleArray } from '@/utils/staticMatchups';
import { validateMatches, buildValidationMap } from '@/utils/matchValidation';
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

  // Automated draw state (mirrors the admin draw page, read-only)
  const [fStatus, setFStatus] = useState('Ready');
  const [mStatus, setMStatus] = useState('Ready');
  const [fStarted, setFStarted] = useState(false);
  const [mStarted, setMStarted] = useState(false);
  const [fDone, setFDone] = useState(false);
  const [mDone, setMDone] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const fCanvasRef = useRef<HTMLCanvasElement>(null);
  const mCanvasRef = useRef<HTMLCanvasElement>(null);
  const fAngle = useRef(0);
  const mAngle = useRef(0);
  const fOrder = useRef<string[]>([]);
  const mOrder = useRef<string[]>([]);
  const autoDrawRef = useRef(false);
  const autoScheduledRef = useRef(false);
  const autoSaveDone = useRef(false);

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
  }

  // --- Automated draw engine (mirrors Admin Draw Page, read-only) ---

  function spinTo(
    cvRef: React.RefObject<HTMLCanvasElement>,
    angleRef: React.MutableRefObject<number>,
    pool: string[], col: string[], target: string, onDone: () => void
  ) {
    const cv = cvRef.current!;
    const n = pool.length, arc = (2 * Math.PI) / n;
    const ti = pool.indexOf(target), ta = ti * arc + arc / 2;
    const norm = ((-angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let diff = ta - norm; if (diff < 0) diff += 2 * Math.PI;
    const tot = (2 + Math.floor(Math.random() * 2)) * 2 * Math.PI + diff;
    const dur = 900 + Math.random() * 300, t0 = performance.now(), a0 = angleRef.current;
    function frame(now: number) {
      const t = Math.min((now - t0) / dur, 1), ease = 1 - Math.pow(1 - t, 4);
      angleRef.current = a0 + tot * ease;
      paintCanvas(cv, angleRef.current, pool, col);
      if (t < 1) requestAnimationFrame(frame); else onDone();
    }
    requestAnimationFrame(frame);
  }

  function generateAllMatches(order: string[], gender: 'female' | 'male'): DrawnMatch[] {
    const matches = generateMatchesFromOrder(order, gender);
    return matches.map(m => ({
      matchNum: m.matchNum,
      p1: m.p1,
      p2: m.p2,
      p3: m.p3,
      p4: m.p4
    }));
  }

  function runSequence(
    cvRef: React.RefObject<HTMLCanvasElement>,
    angleRef: React.MutableRefObject<number>,
    order: string[],
    col: string[],
    preGeneratedMatches: DrawnMatch[],
    idx: number,
    setStatus: (s: string) => void,
    setMatches: React.Dispatch<React.SetStateAction<DrawnMatch[]>>,
    onComplete: () => void
  ) {
    if (idx >= preGeneratedMatches.length) { onComplete(); return; }

    const match = preGeneratedMatches[idx];
    const picks = [match.p1, match.p2, match.p3, match.p4];
    const matchNum = match.matchNum;
    const collected: string[] = [];
    let pi = 0;

    function nextPick() {
      if (pi === 4) {
        setMatches(prev => [...prev, match]);
        setStatus(`Match ${matchNum} drawn`);
        setTimeout(() => runSequence(cvRef, angleRef, order, col, preGeneratedMatches, idx + 1, setStatus, setMatches, onComplete), 150);
        return;
      }
      setStatus(`Match ${matchNum} — ${pi < 2 ? 'team A' : 'team B'} pick ${pi < 2 ? pi + 1 : pi - 1}…`);
      spinTo(cvRef, angleRef, order, col, picks[pi], () => {
        collected.push(picks[pi]);
        setStatus(`${picks[pi]} picked!`);
        setTimeout(() => { pi++; nextPick(); }, 120);
      });
    }
    nextPick();
  }

  function startDivision(gender: 'f' | 'm') {
    const players    = gender === 'f' ? femalePlayers : malePlayers;
    const col        = gender === 'f' ? FC : MC;
    const cvRef      = gender === 'f' ? fCanvasRef : mCanvasRef;
    const angleRef   = gender === 'f' ? fAngle : mAngle;
    const orderRef   = gender === 'f' ? fOrder : mOrder;
    const setStatus  = gender === 'f' ? setFStatus  : setMStatus;
    const setMatches = gender === 'f' ? setFMatches : setMMatches;
    const setStarted = gender === 'f' ? setFStarted : setMStarted;
    const setDone    = gender === 'f' ? setFDone : setMDone;

    const order = shuffleArray(players.map(p => p.name));
    orderRef.current = order;

    const preGeneratedMatches = generateAllMatches(order, gender === 'f' ? 'female' : 'male');
    console.log(`🎯 [AUTO DRAW ${gender.toUpperCase()}] Generated ${preGeneratedMatches.length} matches from shuffled order:`, order);

    setStarted(true);
    setMatches([]);
    runSequence(cvRef, angleRef, order, col, preGeneratedMatches, 0, setStatus, setMatches, () => {
      setStatus('Complete!');
      setDone(true);
      console.log(`✅ [AUTO DRAW ${gender.toUpperCase()}] All matches drawn:`, preGeneratedMatches);
    });
  }

  async function autoSaveDraw() {
    try {
      console.log('🗑️ [AUTO SAVE] Deleting existing matches...');
      const existing = await getDocs(collection(db, 'matches'));

      if (!existing.empty) {
        const delBatch = writeBatch(db);
        existing.docs.forEach(d => delBatch.delete(d.ref));
        await delBatch.commit();

        await new Promise(resolve => setTimeout(resolve, 500));

        const verify = await getDocs(collection(db, 'matches'));
        if (!verify.empty) {
          console.error('❌ [AUTO SAVE] Deletion incomplete!');
          return;
        }
      }

      const playerSnap = await getDocs(collection(db, 'players'));
      const allPlayers = playerSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const byName = (name: string, gender: 'female' | 'male'): string => {
        const found = allPlayers.find(p =>
          p.gender === gender &&
          p.status === 'approved' &&
          p.name?.trim().toLowerCase() === name?.trim().toLowerCase()
        );
        if (!found) throw new Error(`Player not found: "${name}". Draw cannot be saved.`);
        return found.id;
      };

      const wb = writeBatch(db);
      const matchesRef = collection(db, 'matches');

      const femaleMatchStructs = fMatches.map(m => ({
        match_number: m.matchNum,
        gender: 'female' as const,
        teamA: [byName(m.p1, 'female'), byName(m.p2, 'female')] as [string, string],
        teamB: [byName(m.p3, 'female'), byName(m.p4, 'female')] as [string, string],
        score1: 0,
        score2: 0,
        isSubmitted: false
      }));

      const maleMatchStructs = mMatches.map(m => ({
        match_number: m.matchNum,
        gender: 'male' as const,
        teamA: [byName(m.p1, 'male'), byName(m.p2, 'male')] as [string, string],
        teamB: [byName(m.p3, 'male'), byName(m.p4, 'male')] as [string, string],
        score1: 0,
        score2: 0,
        isSubmitted: false
      }));

      const playerMap = buildValidationMap(allPlayers);
      validateMatches(femaleMatchStructs, playerMap);
      validateMatches(maleMatchStructs, playerMap);

      femaleMatchStructs.forEach(match => {
        wb.set(doc(matchesRef), {
          match_number: match.match_number,
          gender: match.gender,
          player1_id: match.teamA[0],
          player2_id: match.teamA[1],
          player3_id: match.teamB[0],
          player4_id: match.teamB[1],
          score1: 0,
          score2: 0,
          is_completed: false
        });
      });

      maleMatchStructs.forEach(match => {
        wb.set(doc(matchesRef), {
          match_number: match.match_number,
          gender: match.gender,
          player1_id: match.teamA[0],
          player2_id: match.teamA[1],
          player3_id: match.teamB[0],
          player4_id: match.teamB[1],
          score1: 0,
          score2: 0,
          is_completed: false
        });
      });

      const savedFemaleMatches = femaleMatchStructs.map((m, i) => ({
        id: `female_match_${i + 1}`,
        match_number: m.match_number,
        gender: 'female' as const,
        teamA: m.teamA,
        teamB: m.teamB,
        score1: 0,
        score2: 0,
        isSubmitted: false
      }));

      const savedMaleMatches = maleMatchStructs.map((m, i) => ({
        id: `male_match_${i + 1}`,
        match_number: m.match_number,
        gender: 'male' as const,
        teamA: m.teamA,
        teamB: m.teamB,
        score1: 0,
        score2: 0,
        isSubmitted: false
      }));

      wb.set(doc(db, 'tournamentSettings', 'settings'), {
        draw_completed: true,
        drawn_female_matches: fMatches,
        drawn_male_matches: mMatches,
        saved_female_matches: savedFemaleMatches,
        saved_male_matches: savedMaleMatches
      }, { merge: true });

      await wb.commit();
      console.log('✅ [AUTO SAVE] Draw saved successfully!');
      setSaved(true);
      setDrawing(false);
    } catch (e) {
      console.error('❌ [AUTO SAVE] Failed to save draw:', e);
      setDrawing(false);
    }
  }

  function runAutoDraw() {
    if (autoDrawRef.current) return;
    autoDrawRef.current = true;
    console.log('🎬 [AUTO DRAW] Countdown finished — starting automated live draw');
    setDrawing(true);
  }

  // STEP 1: Start the female draw once the live view (with canvases) is mounted
  useEffect(() => {
    if (!drawing || fStarted || mStarted) return;
    const t = setTimeout(() => startDivision('f'), 300);
    return () => clearTimeout(t);
  }, [drawing, fStarted, mStarted]);

  useEffect(() => {
    async function load() {
      try {
        const settingsSnap = await getDoc(doc(db, 'tournamentSettings', 'settings'));
        if (settingsSnap.exists()) applySettings(settingsSnap.data(), !!settingsSnap.data().draw_completed);

        // Load approved players so the spin wheels show names exactly like the admin draw page
        const snap = await getDocs(collection(db, 'players'));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
        all.forEach(p => { if (p.name) p.name = p.name.trim(); });
        setFemalePlayers(all.filter(p => p.gender === 'female' && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));
        setMalePlayers(all.filter(p => p.gender === 'male' && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));

        // Load tournament date from default_settings for the countdown
        try {
          const defaultSnap = await getDoc(doc(db, 'tournamentSettings', 'default_settings'));
          const dateStr = defaultSnap.exists() ? defaultSnap.data().tournament_date : null;
          if (dateStr) {
            // Draw is at 9pm the day before the tournament
            const target = new Date(`${dateStr}T21:00:00`);
            target.setDate(target.getDate() - 1);
            setDrawTarget(target.getTime());
          }
        } catch (e) { console.error(e); }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();

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

  // Trigger the automated draw the moment the countdown target is reached
  useEffect(() => {
    if (loading) return;
    if (saved || drawStarted) return;
    if (!drawTarget) return;
    if (now.getTime() < drawTarget) return;
    if (autoDrawRef.current || autoScheduledRef.current) return;
    autoScheduledRef.current = true;
    // Small delay so the page visibly transitions to the live draw experience
    setTimeout(runAutoDraw, 400);
  }, [now, drawTarget, saved, drawStarted, loading]);

  // STEP 2: When female draw completes, automatically start the male draw
  useEffect(() => {
    if (!drawing || !fDone || mStarted) return;
    const t = setTimeout(() => startDivision('m'), 600);
    return () => clearTimeout(t);
  }, [drawing, fDone, mStarted]);

  // STEP 3: When both draws complete, automatically save
  useEffect(() => {
    if (!drawing || !fDone || !mDone || autoSaveDone.current) return;
    autoSaveDone.current = true;
    const t = setTimeout(() => autoSaveDraw(), 500);
    return () => clearTimeout(t);
  }, [drawing, fDone, mDone]);

  useEffect(() => {
    function paint() {
      (['f', 'm'] as const).forEach(d => {
        const cv = d === 'f' ? fCanvasRef.current : mCanvasRef.current;
        if (!cv) return;
        const sz = cv.parentElement?.offsetWidth || 200;
        cv.width = sz; cv.height = sz;
        const order = d === 'f' ? fOrder.current : mOrder.current;
        const names = order.length ? order : (d === 'f' ? femalePlayers : malePlayers).map(p => p.name);
        paintCanvas(cv, d === 'f' ? fAngle.current : mAngle.current, names, d === 'f' ? FC : MC);
      });
    }
    paint();
    const t = setTimeout(paint, 60);
    window.addEventListener('resize', paint);
    return () => { window.removeEventListener('resize', paint); clearTimeout(t); };
  }, [loading, saved, femalePlayers, malePlayers, fOrder.current.length, mOrder.current.length, activeTab, drawing, fDone, mDone, fStarted, mStarted]);

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

  // Live automated draw experience — mirrors the Admin Draw Page (read-only, auto-saves)
  if (drawing) {
    return (
      <div className="min-h-screen bg-sand-gradient">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 text-xs font-semibold text-foreground/60 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live Draw in Progress
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
              Tournament Draw
            </h1>
            <p className="text-sm text-foreground/60 mt-1">
              The wheels are spinning — watch the matchups being generated live!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              {renderWheel('f', fMatches, femalePlayers)}
              {renderWheelStatus('f')}
              {renderMatchGrid(fMatches, `${fMatches.length} Female Matches`)}
            </div>
            <div>
              {renderWheel('m', mMatches, malePlayers)}
              {renderWheelStatus('m')}
              {renderMatchGrid(mMatches, `${mMatches.length} Male Matches`)}
            </div>
          </div>

          <div className="text-center pt-8">
            <p className="text-sm text-foreground/50">
              This is a live automated draw — both divisions will be drawn automatically and saved.
            </p>
          </div>
        </div>
      </div>
    );
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

  function renderWheelStatus(gender: 'f' | 'm') {
    const isFemale = gender === 'f';
    const status = isFemale ? fStatus : mStatus;
    return (
      <div className="flex flex-col items-center mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-white/70 border border-foreground/10 shadow-sand">
          <span className={`w-2 h-2 rounded-full ${status.includes('picked') || status.includes('drawn') || status === 'Complete!' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-foreground/70">{status}</span>
        </div>
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
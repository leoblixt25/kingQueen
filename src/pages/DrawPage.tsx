import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { generateMatchesFromOrder, shuffleArray } from '@/utils/staticMatchups';
import { validateMatches, buildValidationMap } from '@/utils/matchValidation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, RotateCcw, Target, CheckCircle2 } from 'lucide-react';

interface Player { id: string; name: string; gender: string; status: string; }
interface DrawnMatch { matchNum: number; p1: string; p2: string; p3: string; p4: string; }

// App theme colors - Female (warm/sunset tones), Male (cool/ocean blues)
const FC = ['#FF7F50', '#FF6B6B', '#FF8E53', '#FF6B9D', '#FFA07A', '#FF7F7F', '#FF9F43', '#FF6B6B'];
const MC = ['#0066CC', '#0055AA', '#004488', '#0077BB', '#0088CC', '#005599', '#006699', '#003377'];

export default function DrawPage() {
  const navigate = useNavigate();
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([]);
  const [malePlayers, setMalePlayers]     = useState<Player[]>([]);
  const [loading, setLoading]             = useState(true);
  const [fStatus, setFStatus]             = useState('Ready');
  const [mStatus, setMStatus]             = useState('Ready');
  const [fStarted, setFStarted]           = useState(false);
  const [mStarted, setMStarted]           = useState(false);
  const [fDone, setFDone]                 = useState(false);
  const [mDone, setMDone]                 = useState(false);
  const [fMatches, setFMatches]           = useState<DrawnMatch[]>([]);
  const [mMatches, setMMatches]           = useState<DrawnMatch[]>([]);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [loadingTestPlayers, setLoadingTestPlayers] = useState(false);

  const fCanvasRef = useRef<HTMLCanvasElement>(null);
  const mCanvasRef = useRef<HTMLCanvasElement>(null);
  const fAngle     = useRef(0);
  const mAngle     = useRef(0);
  const fOrder     = useRef<string[]>([]);
  const mOrder     = useRef<string[]>([]);

  useEffect(() => { loadPlayers(); }, []);

  useEffect(() => {
    function resize() {
      (['f', 'm'] as const).forEach(d => {
        const cv = d === 'f' ? fCanvasRef.current : mCanvasRef.current;
        if (!cv) return;
        const sz = cv.parentElement?.offsetWidth || 200;
        cv.width = sz; cv.height = sz;
        const pool = (d === 'f' ? fOrder.current : mOrder.current);
        const names = pool.length ? pool : (d === 'f' ? femalePlayers : malePlayers).map(p => p.name);
        paintCanvas(cv, d === 'f' ? fAngle.current : mAngle.current, names, d === 'f' ? FC : MC);
      });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [femalePlayers, malePlayers]);

  async function loadPlayers() {
    try {
      // Load saved draw results if they exist
      const settingsSnap = await getDoc(doc(db, 'tournamentSettings', 'settings'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (data.draw_completed && data.drawn_female_matches && data.drawn_male_matches) {
          setSaved(true);
          setFDone(true);
          setMDone(true);
          setFStarted(true);
          setMStarted(true);
          setFMatches(data.drawn_female_matches);
          setMMatches(data.drawn_male_matches);
          // Restore wheel order from saved matches
          const fNames: string[] = [...new Set((data.drawn_female_matches as DrawnMatch[]).flatMap(m => [m.p1, m.p2, m.p3, m.p4]))];
          const mNames: string[] = [...new Set((data.drawn_male_matches as DrawnMatch[]).flatMap(m => [m.p1, m.p2, m.p3, m.p4]))];
          fOrder.current = fNames;
          mOrder.current = mNames;
        }
      }

      const snap = await getDocs(collection(db, 'players'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      // Trim player names for consistent lookup
      all.forEach(p => { if (p.name) p.name = p.name.trim(); });
      setFemalePlayers(all.filter(p => p.gender === 'female' && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));
      setMalePlayers(all.filter(p => p.gender === 'male'   && p.status === 'approved').map(p => ({ ...p, name: p.name.trim() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function paintCanvas(cv: HTMLCanvasElement, angle: number, pool: string[], col: string[]) {
    const ctx = cv.getContext('2d')!;
    const sz = cv.width, h = sz / 2, r = h - 4, n = pool.length;
    ctx.clearRect(0, 0, sz, sz);
    if (!n) return;
    const arc = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const s = angle + i * arc, e = s + arc;
      ctx.beginPath(); ctx.moveTo(h, h); ctx.arc(h, h, r, s, e); ctx.closePath();
      ctx.fillStyle = col[i % col.length]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(h, h); ctx.rotate(s + arc / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      // Bug 5: Larger font size and bold
      const fs = Math.max(10, sz * 0.065);
      ctx.font = `700 ${fs}px sans-serif`;
      ctx.fillText(pool[i].length > 10 ? pool[i].slice(0, 9) + '…' : pool[i], r - 5, fs * 0.35);
      ctx.restore();
    }
    // Bug 5: Slightly larger center circle
    ctx.beginPath(); ctx.arc(h, h, sz * 0.07, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
  }

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
    const tot = (4 + Math.floor(Math.random() * 4)) * 2 * Math.PI + diff;
    const dur = 2000 + Math.random() * 600, t0 = performance.now(), a0 = angleRef.current;
    function frame(now: number) {
      const t = Math.min((now - t0) / dur, 1), ease = 1 - Math.pow(1 - t, 4);
      angleRef.current = a0 + tot * ease;
      paintCanvas(cv, angleRef.current, pool, col);
      if (t < 1) requestAnimationFrame(frame); else onDone();
    }
    requestAnimationFrame(frame);
  }

  /**
   * Pre-generate all matches from the shuffled player order
   * This is the SINGLE SOURCE OF TRUTH for match generation
   */
  function generateAllMatches(order: string[], gender: 'female' | 'male'): DrawnMatch[] {
    const matches = generateMatchesFromOrder(order, gender);
    // Convert to DrawnMatch format (without gender field)
    return matches.map(m => ({
      matchNum: m.matchNum,
      p1: m.p1,
      p2: m.p2,
      p3: m.p3,
      p4: m.p4
    }));
  }

  /**
   * Animate the wheel through the sequence of matches
   * Uses pre-generated matches - NO RECOMPUTATION during animation
   */
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
        // Use the EXACT pre-generated match - no recomputation
        setMatches(prev => [...prev, match]);
        setStatus(`Match ${matchNum} drawn`);
        setTimeout(() => runSequence(cvRef, angleRef, order, col, preGeneratedMatches, idx + 1, setStatus, setMatches, onComplete), 300);
        return;
      }
      setStatus(`Match ${matchNum} — ${pi < 2 ? 'team A' : 'team B'} pick ${pi < 2 ? pi + 1 : pi - 1}…`);
      spinTo(cvRef, angleRef, order, col, picks[pi], () => {
        collected.push(picks[pi]);
        setStatus(`${picks[pi]} picked!`);
        setTimeout(() => { pi++; nextPick(); }, 260);
      });
    }
    nextPick();
  }

  function startDraw(gender: 'f' | 'm') {
    const players    = gender === 'f' ? femalePlayers : malePlayers;
    const col        = gender === 'f' ? FC : MC;
    const cvRef      = gender === 'f' ? fCanvasRef : mCanvasRef;
    const angleRef   = gender === 'f' ? fAngle : mAngle;
    const orderRef   = gender === 'f' ? fOrder : mOrder;
    const setStatus  = gender === 'f' ? setFStatus  : setMStatus;
    const setMatches = gender === 'f' ? setFMatches : setMMatches;
    const setStarted = gender === 'f' ? setFStarted : setMStarted;
    const setDone    = gender === 'f' ? setFDone : setMDone;
    
    // STEP 1: Shuffle player order ONCE
    const order = shuffleArray(players.map(p => p.name));
    orderRef.current = order;
    
    // STEP 2: Generate ALL matches immediately from the shuffled order
    // This is the SINGLE SOURCE OF TRUTH - these matches are final
    const preGeneratedMatches = generateAllMatches(order, gender === 'f' ? 'female' : 'male');
    
    console.log(`🎯 [DRAW ${gender.toUpperCase()}] Generated ${preGeneratedMatches.length} matches from shuffled order:`, order);
    console.log(`🎯 [DRAW ${gender.toUpperCase()}] Match 1: ${preGeneratedMatches[0]?.p1} & ${preGeneratedMatches[0]?.p2} vs ${preGeneratedMatches[0]?.p3} & ${preGeneratedMatches[0]?.p4}`);
    
    // STEP 3: Start animation (visualization only - matches already determined)
    setStarted(true); 
    setMatches([]);
    runSequence(cvRef, angleRef, order, col, preGeneratedMatches, 0, setStatus, setMatches, () => {
      setStatus('Complete!');
      setDone(true);
      console.log(`✅ [DRAW ${gender.toUpperCase()}] All matches drawn:`, preGeneratedMatches);
    });
  }

  async function saveDraw() {
    setSaving(true);
    try {
      // Bug 1: STEP 1 - Delete ALL existing matches first with verification
      console.log('🗑️ [SAVE] Deleting existing matches...');
      const existing = await getDocs(collection(db, 'matches'));
      console.log(`🗑️ [SAVE] Found ${existing.docs.length} existing matches to delete`);
      
      if (!existing.empty) {
        const delBatch = writeBatch(db);
        existing.docs.forEach(d => delBatch.delete(d.ref));
        await delBatch.commit();
        
        // Bug 1: STEP 2 - Wait for Firestore consistency
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Bug 1: STEP 3 - Verify deletion worked
        const verify = await getDocs(collection(db, 'matches'));
        if (!verify.empty) {
          console.error('❌ [SAVE] Deletion incomplete! Still have', verify.docs.length, 'matches');
          alert('Failed to clear existing matches. Please try again.');
          setSaving(false);
          return;
        }
      }
      console.log('✅ [SAVE] All existing matches deleted');

      // Bug 2: Load players with detailed logging
      const playerSnap = await getDocs(collection(db, 'players'));
      const allPlayers = playerSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      console.log('📋 [SAVE] Players in Firestore:', allPlayers.map(p => `"${p.name}" (id: ${p.id})`));
      console.log('📋 [SAVE] Female wheel order:', fOrder.current);
      console.log('📋 [SAVE] Male wheel order:', mOrder.current);
      console.log('📋 [SAVE] Female matches to save:', fMatches);
      console.log('📋 [SAVE] Male matches to save:', mMatches);

      // Bug 2: Case-insensitive name matching with error throwing
      const byName = (name: string): string => {
        const found = allPlayers.find(p => p.name?.trim().toLowerCase() === name?.trim().toLowerCase());
        if (!found) {
          console.error(`❌ [SAVE] Player not found by name: "${name}"`);
          throw new Error(`Player not found: "${name}". Draw cannot be saved.`);
        }
        return found.id;
      };

      const wb = writeBatch(db);
      const matchesRef = collection(db, 'matches');
      
      // Bug 2: Wrap in try/catch for name errors
      try {
        // STEP 1: Convert names to IDs and build temporary Match structures for validation
        const femaleMatchStructs = fMatches.map(m => {
          const p1id = byName(m.p1);
          const p2id = byName(m.p2);
          const p3id = byName(m.p3);
          const p4id = byName(m.p4);
          console.log(`✅ [SAVE] Female match ${m.matchNum}: ${m.p1}(${p1id}) & ${m.p2}(${p2id}) vs ${m.p3}(${p3id}) & ${m.p4}(${p4id})`);
          return {
            match_number: m.matchNum,
            gender: 'female' as const,
            teamA: [p1id, p2id] as [string, string],
            teamB: [p3id, p4id] as [string, string],
            score1: 0,
            score2: 0,
            isSubmitted: false
          };
        });

        const maleMatchStructs = mMatches.map(m => {
          const p1id = byName(m.p1);
          const p2id = byName(m.p2);
          const p3id = byName(m.p3);
          const p4id = byName(m.p4);
          console.log(`✅ [SAVE] Male match ${m.matchNum}: ${m.p1}(${p1id}) & ${m.p2}(${p2id}) vs ${m.p3}(${p3id}) & ${m.p4}(${p4id})`);
          return {
            match_number: m.matchNum,
            gender: 'male' as const,
            teamA: [p1id, p2id] as [string, string],
            teamB: [p3id, p4id] as [string, string],
            score1: 0,
            score2: 0,
            isSubmitted: false
          };
        });

        // STEP 2: STRICT VALIDATION before writing to Firestore
        const playerMap = buildValidationMap(allPlayers);
        try {
          validateMatches(femaleMatchStructs, playerMap);
          console.log('✅ [SAVE] Female matches validated');
        } catch (fErr) {
          console.error('❌ [SAVE] Female match validation FAILED:', fErr);
          alert('Draw validation failed: Female matches contain invalid player data. Please regenerate the draw.');
          setSaving(false);
          return;
        }
        try {
          validateMatches(maleMatchStructs, playerMap);
          console.log('✅ [SAVE] Male matches validated');
        } catch (mErr) {
          console.error('❌ [SAVE] Male match validation FAILED:', mErr);
          alert('Draw validation failed: Male matches contain invalid player data. Please regenerate the draw.');
          setSaving(false);
          return;
        }

        // STEP 3: Write exactly 14 female + 14 male = 28 total matches
        // Already validated - these IDs are guaranteed valid
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

        // Persist draw results in NEW format (teamA/teamB) for deterministic restoration
        // CRITICAL: This saved state is used for recovery if matches collection is corrupted
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
          // Old format for backward compatibility (display)
          drawn_female_matches: fMatches,
          drawn_male_matches: mMatches,
          // NEW format for deterministic restoration (recovery)
          saved_female_matches: savedFemaleMatches,
          saved_male_matches: savedMaleMatches
        }, { merge: true });

      } catch (nameError) {
        console.error('❌ [SAVE] Name lookup error:', nameError);
        alert(String(nameError));
        setSaving(false);
        return;
      }

      await wb.commit();
      console.log('✅ [SAVE] Draw saved successfully!');
      setSaved(true);
    } catch (e) { 
      console.error('❌ [SAVE] Failed to save draw:', e); 
      alert('Failed to save draw. Check console.'); 
    }
    setSaving(false);
  }

  // Bug 4: Restart draw function
  async function restartDraw() {
    if (!window.confirm('This will clear the current draw and all match data. Players will need to wait for a new draw. Are you sure?')) return;
    try {
      console.log('🔄 [RESTART] Clearing draw data...');
      
      // Clear settings - both old and new format
      await setDoc(doc(db, 'tournamentSettings', 'settings'), {
        draw_completed: false,
        drawn_female_matches: [],
        drawn_male_matches: [],
        saved_female_matches: [],
        saved_male_matches: []
      }, { merge: true });

      // Delete all matches
      const existing = await getDocs(collection(db, 'matches'));
      if (!existing.empty) {
        const delBatch = writeBatch(db);
        existing.docs.forEach(d => delBatch.delete(d.ref));
        await delBatch.commit();
      }

      // Reset local state
      resetDraw();
      console.log('✅ [RESTART] Draw restarted successfully');
    } catch (e) {
      console.error('❌ [RESTART] Failed to restart draw:', e);
      alert('Failed to restart draw.');
    }
  }

  function resetDraw() {
    setFStarted(false); setMStarted(false); setFDone(false); setMDone(false);
    setFMatches([]); setMMatches([]); setFStatus('Ready'); setMStatus('Ready');
    setSaved(false); fAngle.current = 0; mAngle.current = 0;
    fOrder.current = []; mOrder.current = [];
    (['f', 'm'] as const).forEach(d => {
      const cv = d === 'f' ? fCanvasRef.current : mCanvasRef.current;
      const names = (d === 'f' ? femalePlayers : malePlayers).map(p => p.name);
      if (cv) paintCanvas(cv, 0, names, d === 'f' ? FC : MC);
    });
  }

  // Step-based flow: 1 = Female, 2 = Male, 3 = Complete
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  function renderWheel(gender: 'f' | 'm') {
    const isFemale = gender === 'f';
    const started = isFemale ? fStarted : mStarted;
    const done = isFemale ? fDone : mDone;
    const status = isFemale ? fStatus : mStatus;
    const cvRef = isFemale ? fCanvasRef : mCanvasRef;
    const colors = isFemale ? FC : MC;
    const players = isFemale ? femalePlayers : malePlayers;

    return (
      <div className="flex flex-col items-center">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            currentStep === 1 
              ? 'bg-sunset text-white' 
              : fDone 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-500'
          }`}>
            {fDone ? <CheckCircle2 size={16} /> : '1'}
          </div>
          <div className="w-12 h-0.5 bg-gray-200">
            <div className={`h-full transition-all duration-500 ${fDone ? 'bg-green-500' : ''}`} style={{ width: fDone ? '100%' : '0%' }} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            currentStep === 2 
              ? 'bg-ocean text-white' 
              : mDone 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-500'
          }`}>
            {mDone ? <CheckCircle2 size={16} /> : '2'}
          </div>
        </div>

        {/* Division badge */}
        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold mb-4 ${
          isFemale 
            ? 'bg-gradient-to-r from-sunset/20 to-[#FF6B6B]/20 text-sunset-dark border border-sunset/30' 
            : 'bg-gradient-to-r from-ocean/20 to-[#00B4DB]/20 text-ocean-dark border border-ocean/30'
        }`}>
          {isFemale ? '👩 Female Division' : '👨 Male Division'}
        </div>

        {/* Wheel container - larger for mobile recording */}
        <div className="relative w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] mb-4">
          {/* Pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
          </div>
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${
            isFemale ? 'bg-sunset' : 'bg-ocean'
          }`} />
          {/* Canvas */}
          <canvas 
            ref={cvRef} 
            className="relative z-10 w-full h-full rounded-full shadow-2xl"
            style={{ boxShadow: `0 8px 32px ${isFemale ? 'rgba(255,127,80,0.3)' : 'rgba(78,205,196,0.3)'}` }}
          />
          {/* Center hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg z-20 flex items-center justify-center">
            <Target size={20} className={isFemale ? 'text-sunset' : 'text-ocean'} />
          </div>
        </div>

        {/* Status */}
        <p className="text-sm text-foreground/60 text-center font-medium mb-4 min-h-[20px]">
          {status}
        </p>

        {/* Start button */}
        {!started && !done && !saved && (
          <Button 
            onClick={() => startDraw(gender)}
            className={`w-full sm:w-auto touch-target font-semibold px-8 py-4 text-base rounded-xl shadow-lg transition-all duration-300 ${
              isFemale 
                ? 'bg-sunset hover:bg-sunset-dark text-white shadow-sunset/30' 
                : 'bg-ocean hover:bg-ocean-dark text-white shadow-ocean/30'
            }`}
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Start Draw
          </Button>
        )}

        {/* Next step button */}
        {done && currentStep === 1 && (
          <Button 
            onClick={() => setCurrentStep(2)}
            className="w-full sm:w-auto touch-target font-semibold px-8 py-4 text-base rounded-xl bg-ocean hover:bg-ocean-dark text-white shadow-lg shadow-ocean/30"
          >
            Continue to Male Draw
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    );
  }

  function renderMatchGrid(matches: DrawnMatch[], gender: 'f' | 'm') {
    if (matches.length === 0) return null;
    
    const isFemale = gender === 'f';
    
    return (
      <div className="mt-6 w-full">
        <h3 className="text-sm font-semibold text-foreground/70 mb-3 text-center">
          {matches.length} Matches Generated
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {matches.map((m) => (
            <Card key={m.matchNum} className="overflow-hidden border-0 shadow-md">
              <div className={`text-xs font-semibold px-2 py-1 ${
                isFemale ? 'bg-sunset/10 text-sunset-dark' : 'bg-ocean/10 text-ocean-dark'
              }`}>
                Match {m.matchNum}
              </div>
              <CardContent className="p-1 space-y-0">
                <div className={`text-xs font-bold ${isFemale ? 'text-sunset' : 'text-ocean'}`}>
                  {m.p1} & {m.p2}
                </div>
                <div className="text-[10px] text-foreground/40 font-medium text-center">vs</div>
                <div className={`text-xs font-bold ${isFemale ? 'text-[#FF6B6B]' : 'text-[#00B4DB]'}`}>
                  {m.p3} & {m.p4}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-gradient flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">🏐</div>
          <p className="text-foreground/60">Loading players…</p>
        </div>
      </div>
    );
  }

  async function loadTestPlayers() {
    setLoadingTestPlayers(true);
    try {
      const batch = writeBatch(db);

      // 1. Delete ALL matches first (CRITICAL: prevents ID mismatch)
      const matchesSnap = await getDocs(collection(db, 'matches'));
      matchesSnap.docs.forEach(d => batch.delete(d.ref));
      console.log(`🗑️ Deleted ${matchesSnap.docs.length} old matches`);

      // 2. Delete ALL players
      const playersSnap = await getDocs(collection(db, 'players'));
      playersSnap.docs.forEach(d => batch.delete(d.ref));
      console.log(`🗑️ Deleted ${playersSnap.docs.length} old players`);

      // 3. Reset tournament settings (draw state)
      batch.set(doc(db, 'tournamentSettings', 'settings'), {
        draw_completed: false,
        drawn_female_matches: [],
        drawn_male_matches: [],
        saved_female_matches: [],
        saved_male_matches: []
      }, { merge: true });
      console.log('🔄 Reset tournament settings');

      // 4. Create fresh players with NEW IDs
      const playersRef = collection(db, 'players');

      // Create 8 female test players
      for (let i = 1; i <= 8; i++) {
        const playerData = {
          name: `Female Player ${i}`,
          gender: 'female',
          status: 'approved',
          is_confirmed: true,
          points: 0,
          total_scores: 0,
          matches_played: 0,
          position: i,
          approved_at: new Date().toISOString()
        };
        const newDocRef = doc(playersRef);
        batch.set(newDocRef, playerData);
      }

      // Create 8 male test players
      for (let i = 1; i <= 8; i++) {
        const playerData = {
          name: `Male Player ${i}`,
          gender: 'male',
          status: 'approved',
          is_confirmed: true,
          points: 0,
          total_scores: 0,
          matches_played: 0,
          position: i,
          approved_at: new Date().toISOString()
        };
        const newDocRef = doc(playersRef);
        batch.set(newDocRef, playerData);
      }

      await batch.commit();
      console.log('✅ Test players loaded - fresh start');

      // Clear local draw state
      setFMatches([]);
      setMMatches([]);
      setFDone(false);
      setMDone(false);
      setFStarted(false);
      setMStarted(false);
      setSaved(false);

      await loadPlayers(); // Reload to show the new players
    } catch (e) {
      console.error('Failed to load test players:', e);
      alert('Failed to load test players. Check console.');
    }
    setLoadingTestPlayers(false);
  }

  if (femalePlayers.length !== 8 || malePlayers.length !== 8) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-8">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="text-5xl">🏐</div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Tournament Draw</h1>
            <p className="text-foreground/60">Need exactly 8 approved players per division to start the draw.</p>
          </div>
          
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-sunset">{femalePlayers.length}<span className="text-foreground/40">/8</span></div>
                  <div className="text-xs text-foreground/60 font-medium">Female</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-ocean">{malePlayers.length}<span className="text-foreground/40">/8</span></div>
                  <div className="text-xs text-foreground/60 font-medium">Male</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate('/tournament')}
              variant="outline"
              className="w-full touch-target"
            >
              ← Back to Tournament
            </Button>
            <Button 
              onClick={loadTestPlayers}
              disabled={loadingTestPlayers}
              className="w-full touch-target bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loadingTestPlayers ? 'Loading…' : '⚡ Load Test Players'}
            </Button>
          </div>
          
          <p className="text-xs text-foreground/40 max-w-xs mx-auto">
            Test players will be created as approved placeholders and can be replaced when real players register.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-gradient">
      {/* Mobile-first centered container */}
      <div className="max-w-md mx-auto px-4 py-6 sm:py-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 text-xs font-semibold text-foreground/60 mb-3">
            <Target size={14} />
            Live Draw
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
            Tournament Draw
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {saved ? 'Draw completed' : currentStep === 1 ? 'Step 1: Female Division' : 'Step 2: Male Division'}
          </p>
        </div>

        {/* Main content - Step based */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-beach border-sand-dark/20 overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            
            {/* Show Female Draw (Step 1) */}
            {(currentStep === 1 || saved) && (
              <div className={currentStep === 2 && !saved ? 'opacity-50' : ''}>
                {renderWheel('f')}
                {renderMatchGrid(fMatches, 'f')}
              </div>
            )}

            {/* Show Male Draw (Step 2) */}
            {(currentStep === 2 || saved) && fDone && (
              <div className={currentStep === 1 ? 'hidden' : 'mt-6 pt-6 border-t border-sand-dark/10'}>
                {renderWheel('m')}
                {renderMatchGrid(mMatches, 'm')}
              </div>
            )}

            {/* Save buttons - when both done but not saved */}
            {fDone && mDone && !saved && (
              <div className="mt-8 pt-6 border-t border-sand-dark/10 space-y-3">
                <Button 
                  onClick={saveDraw} 
                  disabled={saving}
                  className="w-full touch-target font-semibold py-4 text-base rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg"
                >
                  {saving ? (
                    <><RotateCcw className="w-5 h-5 mr-2 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5 mr-2" /> Save Draw to Tournament</>
                  )}
                </Button>
                <Button 
                  onClick={resetDraw}
                  variant="outline"
                  className="w-full touch-target py-4 text-base"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Reset Draw
                </Button>
              </div>
            )}

            {/* Success state - saved */}
            {saved && (
              <div className="mt-8 pt-6 border-t border-sand-dark/10 space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                    <CheckCircle2 size={16} />
                    Draw Saved — Tournament Open
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">
                    {new Date().toLocaleTimeString()} • All matches assigned
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/tournament')}
                    className="w-full touch-target font-semibold py-4 text-base rounded-xl bg-ocean hover:bg-ocean-dark text-white shadow-lg shadow-ocean/30"
                  >
                    Go to Tournament
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                  
                  <Button 
                    onClick={restartDraw}
                    variant="outline"
                    className="w-full touch-target py-4 text-base border-coral text-coral hover:bg-coral/10"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Restart Draw
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        {!saved && (
          <div className="text-center mt-4">
            <p className="text-xs text-foreground/40">
              Draw is randomly generated using Fisher-Yates shuffle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

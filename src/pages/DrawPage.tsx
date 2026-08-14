import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { generateMatchesFromOrder, shuffleArray } from '@/utils/staticMatchups';
import { validateMatches, buildValidationMap } from '@/utils/matchValidation';
import { FC, MC, paintCanvas } from '@/utils/drawWheel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, RotateCcw, Target, CheckCircle2 } from 'lucide-react';

interface Player { id: string; name: string; gender: string; status: string; }
interface DrawnMatch { matchNum: number; p1: string; p2: string; p3: string; p4: string; }

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

  // Step-based flow: 1 = Female, 2 = Male, 3 = Complete
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

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
    // Re-run when step changes so a newly mounted wheel canvas (e.g. male) is painted at the correct size
    const t = setTimeout(resize, 50);
    return () => { window.removeEventListener('resize', resize); clearTimeout(t); };
  }, [femalePlayers, malePlayers, currentStep, saved, fDone]);

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
        {/* Wheel container */}
        <div className="relative w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] mb-3">
          {/* Pointer */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
          </div>
          {/* Canvas */}
          <canvas 
            ref={cvRef} 
            className="relative z-10 w-full h-full rounded-full shadow-xl"
          />
          {/* Center hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg z-20 flex items-center justify-center">
            <Target size={16} className={isFemale ? 'text-sunset' : 'text-ocean'} />
          </div>
        </div>

        {/* Status */}
        <p className="text-sm font-semibold text-foreground/70 text-center mb-3 min-h-[20px]">
          {status}
        </p>

        {/* Start button */}
        {!started && !done && !saved && (
          <Button 
            onClick={() => startDraw(gender)}
            className={`w-full sm:w-auto touch-target font-semibold px-8 py-3 text-base rounded-xl shadow-lg transition-all duration-300 ${
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
            className="w-full sm:w-auto touch-target font-semibold px-8 py-3 text-base rounded-xl bg-ocean hover:bg-ocean-dark text-white shadow-lg shadow-ocean/30"
          >
            Continue to Male Draw
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    );
  }
// PDF colors
  const PDF_BLUE = 'bg-[#0077B6]';
  const PDF_ORANGE = 'bg-[#FF7F50]';

  function renderMatchGrid(matches: DrawnMatch[], gender: 'f' | 'm') {
    if (matches.length === 0) return null;

    return (
      <div className="w-full">
        {/* Grid: 2 cols on mobile, 2 cols on desktop (all matches visible at once) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {matches.map((m) => (
            <div
              key={m.matchNum}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Header - MATCH X */}
              <div className="bg-gray-100 px-2.5 py-1 border-b border-gray-200">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Match {m.matchNum}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-2 flex flex-col gap-1">
                {/* Team A - Blue */}
                <div className={`${PDF_BLUE} text-white rounded-md py-1 px-1.5`}>
                  <div className="text-[13px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
                    {m.p1} & {m.p2}
                  </div>
                </div>

                {/* VS */}
                <div className="text-[9px] font-bold text-gray-400 text-center py-0.5">
                  VS
                </div>

                {/* Team B - Orange */}
                <div className={`${PDF_ORANGE} text-white rounded-md py-1 px-1.5`}>
                  <div className="text-[13px] font-medium leading-tight text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.15' }}>
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
      {/* Responsive container: narrow on mobile, wide on desktop */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        
        {/* Header - compact single line */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 text-xs font-semibold text-foreground/60">
            <Target size={12} />
            {currentStep === 2 && !saved ? 'Male' : 'Female'} Division
          </span>
          <h1 className="text-lg sm:text-xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
            Tournament Draw
          </h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            saved
              ? 'bg-green-100 text-green-700'
              : currentStep === 1
                ? 'bg-sunset/15 text-sunset-dark border border-sunset/30'
                : 'bg-ocean/15 text-ocean-dark border border-ocean/30'
          }`}>
            {saved ? <CheckCircle2 size={12} /> : null}
            {saved ? 'Completed' : currentStep === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
          </span>
        </div>

        {/* Main content - Step based */}
        <div className="w-full">
          {/* Show Female Draw (Step 1) */}
          {(currentStep === 1 || saved) && (
            <div className={`grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6 items-start ${currentStep === 2 && !saved ? 'opacity-50' : ''}`}>
              <div className="md:sticky md:top-4">{renderWheel('f')}</div>
              <div className="min-w-0">{renderMatchGrid(fMatches, 'f')}</div>
            </div>
          )}

          {/* Show Male Draw (Step 2) */}
          {(currentStep === 2 || saved) && fDone && (
            <div className={`mt-6 pt-4 border-t border-sand-dark/10 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 md:gap-6 items-start ${currentStep === 1 ? 'hidden' : ''}`}>
              <div className="md:sticky md:top-4">{renderWheel('m')}</div>
              <div className="min-w-0">{renderMatchGrid(mMatches, 'm')}</div>
            </div>
          )}

          {/* Save buttons - when both done but not saved */}
          {fDone && mDone && !saved && (
            <div className="mt-8 pt-6 border-t border-sand-dark/10 space-y-3 max-w-md mx-auto">
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
            <div className="mt-8 pt-6 border-t border-sand-dark/10 space-y-4 max-w-md mx-auto">
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
        </div>

      </div>
    </div>
  );
}

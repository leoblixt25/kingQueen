import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, writeBatch, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { generateMatchesFromOrder, shuffleArray, type GeneratedMatch } from '@/utils/staticMatchups';

interface Player { id: string; name: string; gender: string; status: string; }
interface DrawnMatch { matchNum: number; p1: string; p2: string; p3: string; p4: string; }

const FC = ['#FF8A65','#FFB74D','#FF7043','#FFA726','#EF6C00','#F57C00','#E64A19','#FF6D00'];
const MC = ['#42A5F5','#26C6DA','#1E88E5','#00ACC1','#039BE5','#0288D1','#0277BD','#29B6F6'];

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
        // Bug 1: STEP 4 - Write exactly 14 female + 14 male = 28 total matches
        fMatches.forEach(m => {
          const p1id = byName(m.p1);
          const p2id = byName(m.p2);
          const p3id = byName(m.p3);
          const p4id = byName(m.p4);
          console.log(`✅ [SAVE] Female match ${m.matchNum}: ${m.p1}(${p1id}) & ${m.p2}(${p2id}) vs ${m.p3}(${p3id}) & ${m.p4}(${p4id})`);
          wb.set(doc(matchesRef), { 
            match_number: m.matchNum, 
            gender: 'female', 
            player1_id: p1id, 
            player2_id: p2id, 
            player3_id: p3id, 
            player4_id: p4id, 
            score1: 0, 
            score2: 0, 
            is_completed: false 
          });
        });
        
        mMatches.forEach(m => {
          const p1id = byName(m.p1);
          const p2id = byName(m.p2);
          const p3id = byName(m.p3);
          const p4id = byName(m.p4);
          console.log(`✅ [SAVE] Male match ${m.matchNum}: ${m.p1}(${p1id}) & ${m.p2}(${p2id}) vs ${m.p3}(${p3id}) & ${m.p4}(${p4id})`);
          wb.set(doc(matchesRef), { 
            match_number: m.matchNum, 
            gender: 'male', 
            player1_id: p1id, 
            player2_id: p2id, 
            player3_id: p3id, 
            player4_id: p4id, 
            score1: 0, 
            score2: 0, 
            is_completed: false 
          });
        });
      } catch (nameError) {
        console.error('❌ [SAVE] Name lookup error:', nameError);
        alert(String(nameError));
        setSaving(false);
        return;
      }
      
      // Bug 3: Also persist draw results for display
      wb.set(doc(db, 'tournamentSettings', 'settings'), { 
        draw_completed: true,
        drawn_female_matches: fMatches,
        drawn_male_matches: mMatches
      }, { merge: true });
      
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
      
      // Clear settings
      await setDoc(doc(db, 'tournamentSettings', 'settings'), {
        draw_completed: false,
        drawn_female_matches: [],
        drawn_male_matches: []
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

  function renderDivision(gender: 'f' | 'm') {
    const isFemale   = gender === 'f';
    const started    = isFemale ? fStarted  : mStarted;
    const status     = isFemale ? fStatus   : mStatus;
    const matches    = isFemale ? fMatches  : mMatches;
    const cvRef      = isFemale ? fCanvasRef : mCanvasRef;
    const accentBg   = isFemale ? '#FFF3E0' : '#E3F2FD';
    const accentText = isFemale ? '#BF360C'  : '#0D47A1';
    const accentBdr  = isFemale ? '#FFCC80'  : '#90CAF9';

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '.75rem' }}>
          <div style={{ fontSize: 12, fontWeight: 500, padding: '3px 14px', borderRadius: 6, background: accentBg, color: accentText, marginBottom: '.6rem' }}>
            {isFemale ? 'Female division' : 'Male division'}
          </div>
          {/* Bug 5: Larger wheel size */}
          <div style={{ position: 'relative', width: 'min(260px, 70vw)', height: 'min(260px, 70vw)', marginBottom: '.4rem' }}>
            <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid var(--color-text-primary)', zIndex: 10 }} />
            <canvas ref={cvRef} style={{ borderRadius: '50%', width: '100%', height: '100%' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', minHeight: 15, margin: '4px 0' }}>{status}</p>
          {!started && !saved && (
            <button onClick={() => startDraw(gender)} style={{ padding: '7px 20px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: `0.5px solid ${accentBdr}`, background: accentBg, color: accentText, cursor: 'pointer', touchAction: 'manipulation' }}>
              Start draw
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
          {matches.map(m => (
            <div key={m.matchNum} style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden', display: 'inline-table', animation: 'fadeUp .3s ease forwards' }}>
              <span style={{ fontSize: 8, color: 'var(--color-text-secondary)', padding: '2px 6px', background: 'var(--color-background-secondary)', display: 'block' }}>Match {m.matchNum}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 6px', display: 'block', whiteSpace: 'nowrap' }}>{m.p1} &amp; {m.p2}</span>
              <span style={{ fontSize: 8, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1px 0', background: 'var(--color-background-primary)', display: 'block' }}>vs</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#B45309', background: '#FFEDD5', padding: '2px 6px', display: 'block', whiteSpace: 'nowrap' }}>{m.p3} &amp; {m.p4}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading players…</div>;

  async function loadTestPlayers() {
    setLoadingTestPlayers(true);
    try {
      const batch = writeBatch(db);
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
      await loadPlayers(); // Reload to show the new players
    } catch (e) {
      console.error('Failed to load test players:', e);
      alert('Failed to load test players. Check console.');
    }
    setLoadingTestPlayers(false);
  }

  if (femalePlayers.length !== 8 || malePlayers.length !== 8) return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Need exactly 8 approved players per division to start the draw.</p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 8 }}>Female: {femalePlayers.length}/8 &nbsp;|&nbsp; Male: {malePlayers.length}/8</p>
      <div style={{ marginTop: 16, display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
        <button 
          onClick={loadTestPlayers} 
          disabled={loadingTestPlayers}
          style={{ padding: '8px 16px', fontSize: 13, cursor: loadingTestPlayers ? 'not-allowed' : 'pointer', background: '#7C3AED', color: 'white', border: 'none', borderRadius: '4px', opacity: loadingTestPlayers ? 0.7 : 1 }}
        >
          {loadingTestPlayers ? 'Loading…' : '⚡ Load Test Players'}
        </button>
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 11, marginTop: 12, maxWidth: 300, margin: '12px auto 0' }}>
        Test players will be created as approved placeholders and can be replaced when real players register.
      </p>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1rem', fontFamily: 'var(--font-sans)' }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'clamp(16px,4vw,20px)', fontWeight: 500, color: 'var(--color-text-primary)' }}>Tournament draw</h1>
      </div>

      {renderDivision('f')}
      <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border-tertiary)', margin: '1rem 0' }} />
      {renderDivision('m')}

      {fDone && mDone && !saved && (
        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '.75rem' }}>
          <button onClick={saveDraw} disabled={saving} style={{ padding: '9px 22px', fontSize: 13, fontWeight: 500, borderRadius: 6, background: saving ? '#ccc' : '#1B5E20', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', touchAction: 'manipulation' }}>
            {saving ? 'Saving…' : 'Save draw to tournament'}
          </button>
          <button onClick={resetDraw} style={{ padding: '9px 14px', fontSize: 13, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', touchAction: 'manipulation' }}>
            Reset
          </button>
        </div>
      )}

      {saved && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <p style={{ color: 'var(--color-text-success)', fontWeight: 500, fontSize: 14 }}>✓ Draw saved — tournament is now open to players</p>
          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button onClick={() => navigate('/')} style={{ padding: '8px 20px', fontSize: 13, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              Go to tournament →
            </button>
            {/* Bug 4: Restart draw button */}
            <button 
              onClick={restartDraw} 
              style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '0.5px solid #DC2626', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}
            >
              ↺ Restart draw
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

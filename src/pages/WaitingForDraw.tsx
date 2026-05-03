import { useEffect, useState } from 'react';
import { db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function WaitingForDraw({ onDrawComplete }: { onDrawComplete: () => void }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournamentSettings', 'settings'), snap => {
      if (snap.exists() && snap.data()?.draw_completed === true) onDrawComplete();
    });
    return () => unsub();
  }, [onDrawComplete]);

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ fontSize: 48, marginBottom: '1rem' }}>🏐</div>
      <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>Draw not started yet</h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 300, lineHeight: 1.6, marginBottom: 24 }}>
        Your registration is approved! The admin will run the team draw soon — this page updates automatically.
      </p>
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Waiting for draw{dots}
      </div>
    </div>
  );
}

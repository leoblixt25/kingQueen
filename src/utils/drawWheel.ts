// Shared wheel painting logic for the Tournament Draw
// Female (warm/sunset tones), Male (cool/ocean blues)
export const FC = ['#FF7F50', '#FF6B6B', '#FF8E53', '#FF6B9D', '#FFA07A', '#FF7F7F', '#FF9F43', '#FF6B6B'];
export const MC = ['#0066CC', '#0055AA', '#004488', '#0077BB', '#0088CC', '#005599', '#006699', '#003377'];

export function paintWheelTo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, pool: string[], col: string[]) {
  const h = size / 2, r = h - 4, n = pool.length;
  const cx = x + h, cy = y + h;
  if (!n) return;
  const arc = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const s = angle + i * arc, e = s + arc;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, e); ctx.closePath();
    ctx.fillStyle = col[i % col.length]; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + arc / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    const fs = Math.max(14, size * 0.055);
    ctx.font = `700 ${fs}px sans-serif`;
    ctx.fillText(pool[i].length > 10 ? pool[i].slice(0, 9) + '…' : pool[i], r - 18, fs * 0.35);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.07, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
}

export function paintCanvas(cv: HTMLCanvasElement, angle: number, pool: string[], col: string[]) {
  const ctx = cv.getContext('2d')!;
  const sz = cv.width;
  ctx.clearRect(0, 0, sz, sz);
  if (!pool.length) return;
  paintWheelTo(ctx, 0, 0, sz, angle, pool, col);
}

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FC, MC, paintWheelTo } from '@/utils/drawWheel';

const GITHUB_OWNER = 'leoblixt25';
const GITHUB_REPO = 'sandy-draw-videos';
const VIDEO_DIR = 'draw-videos';
const TOKEN_KEY = 'github_draw_token';
const API = 'https://api.github.com';

// Recording canvas: 720x1280 portrait "broadcast" frame at decent resolution
const RW = 720, RH = 1280, WHEEL = 640;

export interface DrawnMatch { matchNum: number; p1: string; p2: string; p3: string; p4: string; }
interface RecState {
  gender: 'f' | 'm';
  angle: number;
  pool: string[];
  status: string;
  matches: DrawnMatch[];
}

let recState: RecState | null = null;
let recCanvas: HTMLCanvasElement | null = null;
let recCtx: CanvasRenderingContext2D | null = null;

/**
 * Store the admin's GitHub token in this browser only (localStorage).
 * Never shipped in the deployed bundle.
 */
export function setGitHubToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function getGitHubToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function hasGitHubToken(): boolean {
  return getGitHubToken().length > 0;
}

/**
 * Create the offscreen recording surface and start recording. The recorded
 * video shows the full draw: title, spinning wheel, live status, and the
 * matchups as they are drawn.
 */
export function createCanvasRecorder(gender: 'f' | 'm', pool: string[]): MediaRecorder | null {
  try {
    recCanvas = document.createElement('canvas');
    recCanvas.width = RW;
    recCanvas.height = RH;
    recCtx = recCanvas.getContext('2d')!;
    recState = { gender, angle: 0, pool, status: 'Ready', matches: [] };

    const stream = recCanvas.captureStream(30);
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) return null;
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    paintRecordingFrame();
    recorder.start();
    return recorder;
  } catch (e) {
    console.error('⚠️ [REC] draw recording unavailable:', e);
    return null;
  }
}

/** Update live draw state (called on every spin frame + on each pick/match). */
export function updateDrawRecording(angle: number, status: string, matches: DrawnMatch[]) {
  if (!recState) return;
  recState.angle = angle;
  if (status) recState.status = status;
  if (matches) recState.matches = matches;
  paintRecordingFrame();
}

function paintRecordingFrame() {
  if (!recCtx || !recCanvas || !recState) return;
  const ctx = recCtx;
  const { gender, angle, pool, status, matches } = recState;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, RH);
  bg.addColorStop(0, '#0f2440');
  bg.addColorStop(0.6, '#12324f');
  bg.addColorStop(1, '#08182c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, RW, RH);

  // Decorative ring
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, RW - 24, RH - 24);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 26px sans-serif';
  ctx.fillText('🏐 KING & QUEEN OF THE BEACH', RW / 2, 58);
  ctx.fillStyle = gender === 'f' ? '#FF8E53' : '#4ECDC4';
  ctx.font = '700 38px sans-serif';
  ctx.fillText(gender === 'f' ? 'FEMALE DIVISION — LIVE DRAW' : 'MALE DIVISION — LIVE DRAW', RW / 2, 106);

  // LIVE badge
  ctx.fillStyle = '#e11d48';
  ctx.beginPath(); ctx.arc(RW - 54, 44, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('LIVE', RW - 24, 50);
  ctx.textAlign = 'center';

  // Wheel (drawn in the middle-top)
  const wx = (RW - WHEEL) / 2, wy = 140;
  paintWheelTo(ctx, wx, wy, WHEEL, angle, pool, gender === 'f' ? FC : MC);

  // Pointer
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(RW / 2, wy + 4);
  ctx.lineTo(RW / 2 - 18, wy + 44);
  ctx.lineTo(RW / 2 + 18, wy + 44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = gender === 'f' ? '#FF8E53' : '#4ECDC4';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Status bar
  const statusY = wy + WHEEL + 58;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, 40, statusY - 44, RW - 80, 70, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 30px sans-serif';
  ctx.fillText(status || 'Ready', RW / 2, statusY + 4);

  // Matchups header
  const headY = statusY + 84;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 24px sans-serif';
  ctx.fillText('MATCHUPS DRAWN', RW / 2, headY);

  // Matchup rows (latest first, up to 8 shown)
  const shown = matches.slice(-8).reverse();
  const rowH = 44;
  let rowY = headY + 26;
  if (shown.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 22px sans-serif';
    ctx.fillText('Waiting for the first match…', RW / 2, rowY + 24);
  }
  shown.forEach(m => {
    const a = gender === 'f' ? '#FF7F50' : '#0088CC';
    const b = gender === 'f' ? '#FF6B9D' : '#006699';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, 40, rowY - 8, RW - 80, rowH, 10);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = a;
    ctx.font = '700 22px sans-serif';
    ctx.fillText(`#${m.matchNum}`, 56, rowY + 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '600 21px sans-serif';
    ctx.fillText(short(m.p1) + ' & ' + short(m.p2), RW / 2 - 50, rowY + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('vs', RW / 2 + 110, rowY + 20);
    ctx.fillStyle = b;
    ctx.fillText(short(m.p3) + ' & ' + short(m.p4), RW / 2 + 190, rowY + 20);
    ctx.textAlign = 'center';
    rowY += rowH;
  });
}

function short(name: string): string {
  return name.length > 9 ? name.slice(0, 8) + '…' : name;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Stop the recorder and resolve the recorded video blob.
 */
export function stopRecorder(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    recorder.stop();
  });
}

/**
 * Commit a small file to the public draw-videos repo via the GitHub Git Data
 * API. Returns the raw public URL. Throws on failure.
 */
async function gitHubCommitFile(filename: string, blob: Blob, message: string): Promise<string> {
  const token = getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // 1. Get current head of main
  const refRes = await fetch(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/main`, { headers });
  if (!refRes.ok) throw new Error(`Could not read repo (${refRes.status})`);
  const head = await refRes.json();
  const headSha = head.object.sha;

  // 2. Create blob from the video bytes (base64)
  const base64 = await blobToBase64(blob);
  const blobRes = await fetch(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: base64, encoding: 'base64' }),
  });
  if (!blobRes.ok) throw new Error(`Video blob upload failed (${blobRes.status})`);
  const blobData = await blobRes.json();

  // 3. Create a tree that adds the video under draw-videos/
  const treeRes = await fetch(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: headSha,
      tree: [{ path: `${VIDEO_DIR}/${filename}`, mode: '100644', type: 'blob', sha: blobData.sha }],
    }),
  });
  if (!treeRes.ok) throw new Error(`Tree update failed (${treeRes.status})`);
  const tree = await treeRes.json();

  // 4. Create the commit
  const commitRes = await fetch(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });
  if (!commitRes.ok) throw new Error(`Commit failed (${commitRes.status})`);
  const commit = await commitRes.json();

  // 5. Move main to the new commit
  const refPatchRes = await fetch(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!refPatchRes.ok) throw new Error(`Repo update failed (${refPatchRes.status})`);

  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${VIDEO_DIR}/${filename}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload the recorded draw video to the public GitHub repo and persist its
 * public URL in the settings doc. No Cloudflare, no Firebase Storage.
 */
export async function uploadDrawVideo(blob: Blob, gender: 'f' | 'm'): Promise<string | null> {
  try {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${gender}_draw_${Date.now()}.${ext}`;
    console.log(`🎥 [REC] Uploading ${gender.toUpperCase()} draw video (${(blob.size / 1024 / 1024).toFixed(1)} MB) to GitHub…`);

    const url = await gitHubCommitFile(
      filename,
      blob,
      `Add ${gender.toUpperCase()} draw recording ${new Date().toISOString()}`
    );

    const field = gender === 'f' ? 'draw_video_female_url' : 'draw_video_male_url';
    await setDoc(doc(db, 'tournamentSettings', 'settings'), {
      [field]: url
    }, { merge: true });
    console.log(`🎥 [REC] ${gender.toUpperCase()} draw video saved: ${url}`);
    return url;
  } catch (e: any) {
    if (e?.message === 'NO_TOKEN') {
      console.error('⚠️ [REC] No GitHub token set — enter it in the Draw page first.');
    } else {
      console.error('⚠️ [REC] video upload failed:', e?.message || e);
    }
    return null;
  }
}
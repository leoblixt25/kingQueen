import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const GITHUB_OWNER = 'leoblixt25';
const GITHUB_REPO = 'sandy-draw-videos';
const VIDEO_DIR = 'draw-videos';
const TOKEN_KEY = 'github_draw_token';
const API = 'https://api.github.com';

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
 * Record the wheel canvas animation to a video while the draw runs.
 * Returns null when canvas recording is unsupported (rare).
 */
export function createCanvasRecorder(canvas: HTMLCanvasElement): MediaRecorder | null {
  try {
    const stream = canvas.captureStream(30);
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mime = types.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) return null;
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_000_000 });
    // Must be started or no frames are captured and the final blob is empty
    recorder.start();
    return recorder;
  } catch (e) {
    console.error('⚠️ [REC] canvas recording unavailable:', e);
    return null;
  }
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
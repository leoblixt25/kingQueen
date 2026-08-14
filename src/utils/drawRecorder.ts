import { doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/config/firebase';

const DRAW_WORKER_URL = 'https://sandy-scorekeeper-workers.leoblixt25.workers.dev';

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
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
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
 * Upload the recorded draw video via the Cloudflare Worker (which pushes it to
 * a GitHub Release) and persist its public URL in the settings doc.
 */
export async function uploadDrawVideo(blob: Blob, gender: 'f' | 'm'): Promise<string | null> {
  try {
    const user = getAuth().currentUser;
    if (!user) {
      console.error('⚠️ [REC] Not signed in — cannot upload video.');
      return null;
    }
    const token = await user.getIdToken();

    console.log(`🎥 [REC] Uploading ${gender.toUpperCase()} draw video (${blob.size} bytes) via Cloudflare Worker → GitHub...`);
    const res = await fetch(DRAW_WORKER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Gender': gender,
        'Content-Type': blob.type || 'video/webm',
      },
      body: blob,
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || `Upload failed (${res.status})`);
    }
    const url = result.url as string;
    if (!url) throw new Error('Worker did not return a video URL');

    const field = gender === 'f' ? 'draw_video_female_url' : 'draw_video_male_url';
    await setDoc(doc(db, 'tournamentSettings', 'settings'), {
      [field]: url
    }, { merge: true });
    console.log(`🎥 [REC] ${gender.toUpperCase()} draw video saved: ${url}`);
    return url;
  } catch (e: any) {
    const msg = e?.code || e?.message || 'unknown error';
    console.error('⚠️ [REC] video upload failed:', msg);
    return null;
  }
}
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { db } from '@/config/firebase';

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
 * Upload the recorded draw video and persist its public URL in the settings doc.
 */
export async function uploadDrawVideo(blob: Blob, gender: 'f' | 'm'): Promise<string | null> {
  try {
    const storage = getStorage();
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fileRef = storageRef(storage, `draw/${gender}_draw_${Date.now()}.${ext}`);
    await uploadBytes(fileRef, blob);
    const url = await getDownloadURL(fileRef);
    const field = gender === 'f' ? 'draw_video_female_url' : 'draw_video_male_url';
    await setDoc(doc(db, 'tournamentSettings', 'settings'), {
      [field]: url
    }, { merge: true });
    console.log(`🎥 [REC] ${gender.toUpperCase()} draw video uploaded (${blob.size} bytes)`);
    return url;
  } catch (e) {
    console.error('⚠️ [REC] video upload failed:', e);
    return null;
  }
}
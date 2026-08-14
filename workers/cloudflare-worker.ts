import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ExecutionContext } from '@cloudflare/workers-types';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  GITHUB_TOKEN: string;
}

const OWNER = 'leoblixt25';
const REPO = 'sandy-scorekeeper';
const RELEASE_TAG = 'draw-videos';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gender',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      if (getApps().length === 0) {
        initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
      }
      const auth = getAuth();

      // Route: video upload (has X-Gender header) vs delete-users (JSON body)
      const gender = request.headers.get('X-Gender');
      if (gender === 'f' || gender === 'm') {
        return await handleVideoUpload(request, auth, env, gender);
      }
      return await handleDeleteUsers(request, auth);
    } catch (e) {
      console.error('❌ cloudflare-worker error:', e);
      if (e instanceof HttpError) {
        return json({ error: e.message }, e.status);
      }
      return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
    }
  },
};

async function verifyAdmin(auth: ReturnType<typeof getAuth>, request: Request): Promise<{ email: string }> {
  const firebaseToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!firebaseToken) throw new HttpError(400, 'Firebase token required');
  const decoded = await auth.verifyIdToken(firebaseToken);
  if (!decoded.email || decoded.email !== ADMIN_EMAIL) {
    throw new HttpError(403, 'Unauthorized: Admin privileges required');
  }
  return { email: decoded.email };
}

// ── Video upload → GitHub Release ─────────────────────────────────────────────
async function handleVideoUpload(
  request: Request,
  auth: ReturnType<typeof getAuth>,
  env: Env,
  gender: 'f' | 'm'
): Promise<Response> {
  await verifyAdmin(auth, request);

  const contentType = request.headers.get('Content-Type') || 'video/webm';
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
  const filename = `${gender}_draw_${Date.now()}.${ext}`;
  const data = await request.arrayBuffer();

  if (data.byteLength === 0) return json({ error: 'Empty video body' }, 400);

  let releaseId = await getReleaseId(env.GITHUB_TOKEN);
  if (!releaseId) {
    releaseId = await createRelease(env.GITHUB_TOKEN);
  }

  const asset = await uploadAsset(env.GITHUB_TOKEN, releaseId, filename, contentType, data);
  console.log(`🎥 Uploaded ${filename} → ${asset.browser_download_url}`);
  return json({ success: true, url: asset.browser_download_url, filename });
}

async function getReleaseId(token: string): Promise<number | null> {
  try {
    const r = await gh(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`, token);
    return r.id;
  } catch {
    return null;
  }
}

async function createRelease(token: string): Promise<number> {
  const r = await gh(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, token, {
    method: 'POST',
    body: JSON.stringify({ tag_name: RELEASE_TAG, name: 'Draw Videos', draft: false, prerelease: false }),
  });
  return r.id;
}

async function uploadAsset(
  token: string,
  releaseId: number,
  filename: string,
  contentType: string,
  data: ArrayBuffer
): Promise<{ browser_download_url: string }> {
  const res = await fetch(
    `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
      },
      body: data,
    }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, `GitHub asset upload failed: ${JSON.stringify(body)}`);
  return body;
}

async function gh(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, `GitHub API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// ── Delete Firebase users (existing reset feature) ────────────────────────────
async function handleDeleteUsers(request: Request, auth: ReturnType<typeof getAuth>): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { token?: string };
  const { token } = body;
  if (!token) return json({ error: 'Token is required' }, 400);

  const decodedToken = await auth.verifyIdToken(token);
  const email = decodedToken.email;
  if (!email) return json({ error: 'Email not found in token' }, 400);
  if (email !== ADMIN_EMAIL) return json({ error: 'Unauthorized: Admin privileges required' }, 403);

  let deletedCount = 0;
  let errorCount = 0;
  const listUsersResult = await auth.listUsers(1000);
  for (const user of listUsersResult.users) {
    if (user.email === ADMIN_EMAIL) continue;
    try {
      await auth.deleteUser(user.uid);
      deletedCount++;
    } catch (error) {
      errorCount++;
      console.error(`❌ Error deleting user ${user.email || user.uid}:`, error);
    }
  }
  return json({ success: true, message: `Successfully deleted ${deletedCount} users`, deletedCount, errorCount });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

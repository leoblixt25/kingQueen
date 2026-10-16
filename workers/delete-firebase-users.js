/**
 * Delete All Registered Player Accounts — Cloudflare Worker RELAY.
 *
 * Deployed as "sandy-scorekeeper-workers" via wrangler.toml.
 *
 * Architecture (free-plan friendly — NO crypto in the request path):
 *   1. Verifies the caller's Firebase ID token with Google (Identity Toolkit
 *      accounts:lookup) and requires the admin email. Cheap: one fetch.
 *   2. Triggers the GitHub Actions workflow "Delete registered players"
 *      (repository_dispatch), which performs the actual deletion on GitHub's
 *      infrastructure with unlimited free compute.
 *
 * GitHub credentials — TWO options, App preferred:
 *
 *   (A) GitHub App  ← RECOMMENDED, permanent
 *       Secrets: GH_APP_ID, GH_APP_PRIVATE_KEY  [and optionally
 *       GH_APP_INSTALLATION_ID]
 *       The App's private key does NOT expire and cannot be leak-revoked like
 *       a PAT. The worker mints a short-lived (1h) installation token on demand
 *       and caches it per isolate. This is what fixed the recurring
 *       "GitHub dispatch failed (401)" caused by an expired/revoked GH_PAT.
 *       Required App permissions: Contents = Read and write (to dispatch),
 *       Actions = Read (to poll run status). The App must be installed on the
 *       repository below.
 *
 *   (B) Personal Access Token  ← legacy fallback
 *       Secret: GH_PAT
 *       Used only when the App secrets above are absent. PATs expire/rotate,
 *       which is the failure this worker now avoids.
 *
 * The app polls the public GitHub Actions runs API for the outcome, so this
 * worker only needs to return "dispatched" quickly.
 */

const GITHUB_REPO = 'leoblixt25/kingQueen';
const GITHUB_OWNER = 'leoblixt25';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
const WEB_API_KEY = 'AIzaSyBmLIUYNdvR1DIlVPjVpkU003zC6UyRzgY';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
  });
}

// ---------- base64url / PEM helpers ----------

function bytesToB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToB64Url(str) {
  const bin = btoa(unescape(encodeURIComponent(str)));
  return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToBytes(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Decode a PEM body to DER bytes. Accepts PKCS#1 ("BEGIN RSA PRIVATE KEY",
 * what GitHub App keys use) or PKCS#8 ("BEGIN PRIVATE KEY", what Google
 * service-account keys use) and always returns PKCS#8 for WebCrypto import.
 *
 * Secrets are often stored as a single line with literal "\n" escapes, so we
 * normalise those to real newlines before parsing.
 */
function pemToPkcs8Bytes(pem) {
  const normalized = String(pem).replace(/\\n/g, '\n');
  const isPkcs1 = /BEGIN RSA PRIVATE KEY/.test(normalized);
  const body = normalized
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = b64ToBytes(body);
  return isPkcs1 ? pkcs1ToPkcs8(der) : der;
}

// Minimal DER length encoder.
function derLen(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

// Wrap a PKCS#1 RSAPrivateKey in a PKCS#8 PrivateKeyInfo (RSA).
function pkcs1ToPkcs8(pkcs1) {
  const rsaOid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  const algId = [0x30, ...derLen(rsaOid.length + 2), ...rsaOid, 0x05, 0x00];
  const version = [0x02, 0x01, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length), ...pkcs1];
  const body = [...version, ...algId, ...octet];
  return new Uint8Array([0x30, ...derLen(body.length), ...body]);
}

// ---------- Verify caller via Google (no local crypto) ----------

async function verifyCaller(idToken) {
  const resp = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + WEB_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: idToken }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || !Array.isArray(data.users) || !data.users[0]) {
    throw new Error('Invalid or expired login token');
  }
  return data.users[0]; // Google-verified account record
}

// ---------- GitHub App installation token (cached per isolate) ----------

let cachedInstallationToken = null;
let cachedInstallationTokenExp = 0;

function ghHeaders(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sandy-scorekeeper-worker',
    'Content-Type': 'application/json',
  };
}

async function signAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  // GitHub rejects iat in the future and exp more than 10 minutes out.
  const claim = { iat: now - 60, exp: now + 540, iss: String(appId) };
  const unsigned = strToB64Url(JSON.stringify(header)) + '.' + strToB64Url(JSON.stringify(claim));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Bytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  return unsigned + '.' + bytesToB64Url(new Uint8Array(signature));
}

async function getInstallationToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedInstallationToken && cachedInstallationTokenExp - 120 > now) {
    return cachedInstallationToken;
  }

  const jwt = await signAppJwt(env.GH_APP_ID, env.GH_APP_PRIVATE_KEY);

  let installationId = env.GH_APP_INSTALLATION_ID;
  if (!installationId) {
    const listResp = await fetch('https://api.github.com/app/installations', {
      headers: ghHeaders(jwt),
    });
    if (!listResp.ok) {
      const text = await listResp.text();
      throw new Error('Failed to list App installations (' + listResp.status + '): ' + text.slice(0, 200));
    }
    const installations = await listResp.json();
    const match =
      installations.find(
        (i) => i.account && String(i.account.login).toLowerCase() === GITHUB_OWNER.toLowerCase()
      ) || installations[0];
    if (!match) throw new Error('GitHub App is not installed on ' + GITHUB_OWNER);
    installationId = match.id;
  }

  const tokenResp = await fetch(
    'https://api.github.com/app/installations/' + installationId + '/access_token',
    { method: 'POST', headers: ghHeaders(jwt) }
  );
  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    throw new Error('Failed to create installation token (' + tokenResp.status + '): ' + text.slice(0, 200));
  }
  const data = await tokenResp.json();
  if (!data.token) throw new Error('No installation token returned: ' + JSON.stringify(data).slice(0, 200));

  cachedInstallationToken = data.token;
  cachedInstallationTokenExp = now + (data.expires_in ? Math.min(data.expires_in, 3600) : 3600);
  return cachedInstallationToken;
}

/**
 * Prefer the GitHub App (permanent); fall back to a PAT only if the App secrets
 * are absent, so an existing deployment keeps working until the App is set up.
 */
async function resolveGithubToken(env) {
  if (env.GH_APP_ID && env.GH_APP_PRIVATE_KEY) {
    return getInstallationToken(env);
  }
  if (env.GH_PAT) {
    return env.GH_PAT;
  }
  throw new Error(
    'Worker misconfigured: set GH_APP_ID + GH_APP_PRIVATE_KEY (recommended) or GH_PAT'
  );
}

// ---------- Trigger GitHub Actions deletion ----------

async function dispatchDeletion(githubToken, idToken) {
  const resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'POST',
    headers: ghHeaders(githubToken),
    body: JSON.stringify({
      event_type: 'delete-users',
      client_payload: { idToken: idToken },
    }),
  });

  if (resp.status !== 204) {
    const text = await resp.text();
    throw new Error('GitHub dispatch failed (' + resp.status + '): ' + text.slice(0, 300));
  }
}

// ---------- Check latest matching GitHub Action run status ----------

async function getRunStatus(githubToken, sinceIso) {
  try {
    const resp = await fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/actions/runs?per_page=5',
      { headers: ghHeaders(githubToken) }
    );
    if (!resp.ok) return { status: 'error', detail: 'github_api_' + resp.status };

    const data = await resp.json();
    const run = (data.workflow_runs || []).find(
      w => w.event === 'repository_dispatch' &&
           new Date(w.created_at).getTime() >= new Date(sinceIso).getTime()
    );
    if (!run) return { status: 'none' };
    return { status: run.status, conclusion: run.conclusion };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- Worker entry point ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      // Status endpoint for polling the GitHub Action outcome
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const since = url.searchParams.get('since');
        if (url.pathname === '/status' && since && (env.GH_APP_ID || env.GH_PAT)) {
          try {
            const token = await resolveGithubToken(env);
            const status = await getRunStatus(token, since);
            return jsonResponse(status, 200);
          } catch (err) {
            return jsonResponse(
              { status: 'error', detail: err instanceof Error ? err.message : String(err) },
              200
            );
          }
        }
      }
      return jsonResponse({ status: 'online', hint: 'POST the request to this URL' }, 200);
    }

    try {
      if (!(env.GH_APP_ID && env.GH_APP_PRIVATE_KEY) && !env.GH_PAT) {
        return jsonResponse(
          { error: 'Worker misconfigured: set GH_APP_ID + GH_APP_PRIVATE_KEY (recommended) or GH_PAT' },
          500
        );
      }

      const body = await request.json();
      if (!body.token) {
        return jsonResponse({ error: 'Token is required' }, 400);
      }

      // 1. Verify the caller's Firebase identity (Google does the crypto)
      let user;
      try {
        user = await verifyCaller(body.token);
      } catch (err) {
        return jsonResponse({ error: 'Unauthorized: ' + err.message }, 403);
      }

      if (user.email !== ADMIN_EMAIL) {
        return jsonResponse({ error: 'Unauthorized: Admin privileges required' }, 403);
      }

      console.log('Admin verified:', user.email);

      // 2. Kick off the GitHub Action that performs the deletion
      const githubToken = await resolveGithubToken(env);
      await dispatchDeletion(githubToken, body.token);

      return jsonResponse({
        success: true,
        started: true,
        message: 'Deletion started on GitHub Actions',
      });
    } catch (error) {
      console.error('Error in delete-firebase-users worker:', error);
      return jsonResponse(
        {
          error: 'Failed to start deletion',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  },
};

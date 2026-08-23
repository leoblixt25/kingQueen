/**
 * Delete All Registered Player Accounts — Cloudflare Worker (plain JS)
 *
 * Paste this entire file into the Cloudflare dashboard code editor
 * (Workers & Pages > sandy-scorekeeper-workers > Edit code).
 *
 * Required Secret variable: FIREBASE_SERVICE_ACCOUNT
 *   = the FULL contents of the service-account JSON downloaded from
 *     Firebase Console > Project Settings > Service Accounts.
 *
 * Security:
 *   - Verifies the caller's Firebase ID token (signature, expiry, audience)
 *   - Only proceeds when the token belongs to the admin email below
 *   - Deletes ONLY Authentication accounts (except the admin account)
 *   - Never touches Firestore data (players, matches, scores, rankings)
 */

const PROJECT_ID = 'kingqueen-c3543';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
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

// ---------- base64url helpers ----------

function b64UrlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToB64Url(str) {
  const bin = btoa(unescape(encodeURIComponent(str)));
  return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8Bytes(pem) {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  return b64UrlToBytes(b64);
}

// ---------- Service-account auth: signed JWT -> access token ----------

async function getAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = strToB64Url(JSON.stringify(header)) + '.' + strToB64Url(JSON.stringify(claim));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Bytes(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = unsigned + '.' + bytesToB64Url(new Uint8Array(signature));

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error('Could not obtain Google access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// ---------- Verify the caller's Firebase ID token ----------

async function verifyFirebaseIdToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');

  const header = JSON.parse(new TextDecoder().decode(b64UrlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(parts[1])));

  if (header.alg !== 'RS256') throw new Error('Unsupported token algorithm');

  // Google publishes the token-signing public keys in JWK format
  const jwksResp = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!jwksResp.ok) throw new Error('Could not fetch Google public keys');
  const jwks = await jwksResp.json();

  const jwk = jwks.keys.find(function (k) { return k.kid === header.kid; });
  if (!jwk) throw new Error('Token signed with unknown key');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    b64UrlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!signatureValid) throw new Error('Invalid token signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.aud !== PROJECT_ID) throw new Error('Token issued for wrong project');
  if (payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) throw new Error('Invalid token issuer');

  return payload;
}

// ---------- List users (paginated) via Identity Toolkit Admin REST API ----------

async function listAllUsers(accessToken) {
  const users = [];
  let nextPageToken = undefined;

  do {
    const body = { maxResults: 1000 };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID + '/accounts:batchGet',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await resp.json();
    if (!resp.ok) throw new Error('Failed to list users: ' + JSON.stringify(data));

    if (Array.isArray(data.users)) users.push.apply(users, data.users);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return users;
}

// ---------- Delete users in chunks of up to 1000 ----------

async function deleteUsersChunked(accessToken, localIds) {
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < localIds.length; i += 1000) {
    const chunk = localIds.slice(i, i + 1000);

    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID + '/accounts:batchDelete',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localids: chunk, force: true }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error('batchDelete request failed:', JSON.stringify(data));
      errorCount += chunk.length;
      continue;
    }

    // Each result carries a status only when something went wrong
    if (Array.isArray(data.results)) {
      for (const r of data.results) {
        if (!r.status || r.status === 'OK') deletedCount++;
        else {
          errorCount++;
          console.error('Failed to delete user ' + r.localId + ': ' + r.status);
        }
      }
    } else {
      deletedCount += chunk.length;
    }
  }

  return { deletedCount: deletedCount, errorCount: errorCount };
}

// ---------- Worker entry point ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ status: 'online', hint: 'POST the request to this URL' }, 200);
    }

    try {
      if (!env.FIREBASE_SERVICE_ACCOUNT) {
        return jsonResponse({ error: 'Worker misconfigured: FIREBASE_SERVICE_ACCOUNT secret is missing' }, 500);
      }

      const body = await request.json();
      if (!body.token) {
        return jsonResponse({ error: 'Token is required' }, 400);
      }

      // 1. Verify the caller's Firebase identity (server-side)
      let payload;
      try {
        payload = await verifyFirebaseIdToken(body.token);
      } catch (err) {
        return jsonResponse({ error: 'Unauthorized: ' + err.message }, 403);
      }

      if (payload.email !== ADMIN_EMAIL) {
        return jsonResponse({ error: 'Unauthorized: Admin privileges required' }, 403);
      }

      console.log('Admin verified:', payload.email, '(' + payload.user_id + ')');

      // 2. Exchange the service account for a short-lived Google access token
      const accessToken = await getAccessToken(env.FIREBASE_SERVICE_ACCOUNT);

      // 3. List every auth account
      const allUsers = await listAllUsers(accessToken);

      // 4. Collect everyone except the admin
      const toDelete = [];
      let skippedAdmin = 0;
      for (const u of allUsers) {
        if (u.email === ADMIN_EMAIL) {
          skippedAdmin++;
          continue;
        }
        toDelete.push(u.localId);
      }

      // 5. Delete them (Auth accounts only — no database records touched)
      const outcome = await deleteUsersChunked(accessToken, toDelete);

      console.log(
        'Done. Deleted:', outcome.deletedCount,
        '| Failed:', outcome.errorCount,
        '| Admin kept:', skippedAdmin
      );

      return jsonResponse({
        success: true,
        message: 'Successfully deleted ' + outcome.deletedCount + ' users',
        deletedCount: outcome.deletedCount,
        errorCount: outcome.errorCount,
      });
    } catch (error) {
      console.error('Error in delete-firebase-users worker:', error);
      return jsonResponse(
        {
          error: 'Failed to delete users',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  },
};

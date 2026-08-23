/**
 * Delete All Registered Player Accounts — standalone Node script for GitHub Actions.
 *
 * Zero npm dependencies (Node 20+: global fetch + node:crypto).
 *
 * Usage: node delete-users-github-action.mjs <callerIdToken>
 * Env:   SA_JSON = FULL contents of the Firebase service-account JSON.
 *
 * Security:
 *   - Verifies the caller's Firebase ID token with Google (Identity Toolkit)
 *     and aborts unless it belongs to ADMIN_EMAIL. Anyone able to trigger this
 *     workflow without a valid admin login can do nothing.
 *   - Deletes ONLY Authentication accounts except ADMIN_EMAIL.
 *   - Never touches Firestore data.
 */

import { createSign } from 'node:crypto';

const PROJECT_ID = 'kingqueen-c3543';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
const WEB_API_KEY = 'AIzaSyB59VBp3g79K0yYxcCmxwdp0mvgGTbdxxU';

function b64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

// ---------- arguments ----------
const idToken = process.argv[2] || '';
const saRaw = process.env.SA_JSON || '';

if (!idToken) fail('Missing caller ID token');
if (!saRaw) fail('SA_JSON secret is not configured');

let sa;
try {
  sa = JSON.parse(saRaw);
} catch {
  fail('SA_JSON secret is not valid JSON');
}

// ---------- 1. Verify caller ----------
let callerEmail = null;
try {
  const resp = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + WEB_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const data = await resp.json();
  if (resp.ok && Array.isArray(data.users) && data.users[0]) {
    callerEmail = data.users[0].email || null;
  }
} catch (e) {
  fail('Token verification request failed: ' + e.message);
}

if (callerEmail !== ADMIN_EMAIL) {
  fail('Unauthorized: caller is not the admin (' + callerEmail + ')');
}
console.log('Admin verified:', callerEmail);

// ---------- 2. Service-account JWT -> access token ----------
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'RS256', typ: 'JWT' };
const claim = {
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
};

const unsigned = b64Url(JSON.stringify(header)) + '.' + b64Url(JSON.stringify(claim));

let signature;
try {
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signature = signer.sign(sa.private_key);
} catch (e) {
  fail('Failed to sign service-account JWT: ' + e.message);
}

const jwt = unsigned + '.' + b64Url(signature);

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
  fail('Could not obtain Google access token: ' + JSON.stringify(tokenData));
}
const accessToken = tokenData.access_token;

// ---------- 3. List every auth account ----------
const allUsers = [];
let nextPageToken;
do {
  const body = { maxResults: 1000 };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  const resp = await fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID + '/accounts:batchGet',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const data = await resp.json();
  if (!resp.ok) fail('Failed to list users: ' + JSON.stringify(data));

  if (Array.isArray(data.users)) allUsers.push(...data.users);
  nextPageToken = data.nextPageToken;
} while (nextPageToken);

// ---------- 4. Collect everyone except admin ----------
const toDelete = [];
let skippedAdmin = 0;
for (const u of allUsers) {
  if (u.email === ADMIN_EMAIL) {
    skippedAdmin++;
    continue;
  }
  toDelete.push(u.localId);
}

// ---------- 5. Delete in chunks of up to 1000 ----------
let deletedCount = 0;
let errorCount = 0;

for (let i = 0; i < toDelete.length; i += 1000) {
  const chunk = toDelete.slice(i, i + 1000);

  const resp = await fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID + '/accounts:batchDelete',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
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

console.log(
  'Done. Deleted: ' + deletedCount + ' | Failed: ' + errorCount + ' | Admin kept: ' + skippedAdmin
);
console.log('RESULT Deleted=' + deletedCount + ' Failed=' + errorCount + ' AdminKept=' + skippedAdmin);

process.exit(errorCount > 0 ? 1 : 0);
